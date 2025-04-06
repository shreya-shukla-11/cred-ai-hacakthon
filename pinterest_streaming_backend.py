from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import json
import time
from multiprocessing.pool import ThreadPool
from tqdm import tqdm

# Import modules from the original Pinterest scraper
from pinterest_scraper_test import (
    scrape_pinterest_board,
    process_pin,
    encode_image
)

# Import the Milvus client for vector search
from milvus.store import MilvusDualClient
from milvus.fetch import MilvusDualSearch

app = Flask(__name__)

# More permissive CORS setup
CORS(app, resources={r"/*": {"origins": "*"}}, 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "Accept"],
     methods=["GET", "POST", "OPTIONS"])

# Initialize Milvus client
def get_search_client():
    milvus_client = MilvusDualClient(
        host="localhost", 
        port="19530", 
        text_collection_name="fashion_items_text", 
        image_collection_name="fashion_items_image"
    )
    
    search_client = MilvusDualSearch(
        text_collection=milvus_client.text_collection, 
        image_collection=milvus_client.image_collection
    )
    
    return search_client

@app.route('/api/scrape_pinterest', methods=['POST', 'OPTIONS'])
def stream_pinterest_results():
    """
    Stream Pinterest board scraping and processing results
    
    Sends two responses:
    1. Initial pins data as soon as the board is scraped
    2. Processed results with similar items as they become available
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    if not data or 'board_url' not in data:
        return jsonify({"error": "Missing board_url in request"}), 400
    
    board_url = data['board_url']
    max_pins = data.get('max_pins', 10)
    num_threads = data.get('num_threads', 5)
    
    app.logger.info(f"Received request to process board: {board_url}")
    
    def generate():
        try:
            # Get the search client
            search_client = get_search_client()
            
            # First step: Scrape the Pinterest board
            app.logger.info(f"Scraping Pinterest board: {board_url}")
            pins = scrape_pinterest_board(board_url)
            app.logger.info(f"Found {len(pins)} pins")
            
            if max_pins:
                pins = pins[:max_pins]
            
            # Send the initial pins data to the client
            initial_response = {
                "status": "pins_scraped",
                "board_url": board_url,
                "pins": pins,
                "total_pins": len(pins)
            }
            yield f"data: {json.dumps(initial_response)}\n\n"
            
            # Process pins in parallel
            app.logger.info(f"Processing {len(pins)} pins with {num_threads} threads")
            with ThreadPool(num_threads) as pool:
                results_iter = pool.imap(
                    lambda pin: process_pin(pin, search_client), 
                    pins
                )
                
                all_processed_pins = []
                pin_counter = 0
                for result in results_iter:
                    pin_counter += 1
                    app.logger.info(f"Processed pin {pin_counter}/{len(pins)}")
                    if result:
                        all_processed_pins.append(result)
                        # Send each processed pin as it becomes available
                        processed_response = {
                            "status": "pin_processed",
                            "processed_pin": result
                        }
                        yield f"data: {json.dumps(processed_response)}\n\n"
            
            # Send final complete result - break it into chunks to avoid issues with large responses
            app.logger.info(f"Processing complete. Sending final results with {len(all_processed_pins)} pins.")
            
            # First send a "complete_start" event with metadata only
            start_response = {
                "status": "complete_start",
                "board_url": board_url,
                "total_pins": len(all_processed_pins)
            }
            yield f"data: {json.dumps(start_response)}\n\n"
            
            # Then send each processed pin separately
            for i, pin in enumerate(all_processed_pins):
                pin_response = {
                    "status": "complete_pin",
                    "pin_index": i,
                    "total_pins": len(all_processed_pins),
                    "pin_data": pin
                }
                yield f"data: {json.dumps(pin_response)}\n\n"
            
            # Finally send a "complete_end" event
            end_response = {
                "status": "complete_end",
                "board_url": board_url,
                "total_pins": len(all_processed_pins)
            }
            yield f"data: {json.dumps(end_response)}\n\n"
            
        except Exception as e:
            app.logger.error(f"Error processing request: {str(e)}")
            error_response = {
                "status": "error",
                "error": str(e)
            }
            yield f"data: {json.dumps(error_response)}\n\n"
    
    # Set proper headers for SSE
    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',  # Disable proxy buffering
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers=headers
    )

@app.route('/api/test', methods=['GET'])
def test_endpoint():
    """Simple test endpoint to check if the server is running"""
    return jsonify({"status": "ok", "message": "Server is running"}), 200

if __name__ == '__main__':
    # Enable debug logging
    import logging
    logging.basicConfig(level=logging.INFO)
    app.logger.setLevel(logging.INFO)
    
    app.logger.info("Starting Pinterest streaming backend server...")
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True) 
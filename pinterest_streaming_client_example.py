import requests
import json
import argparse
import sseclient  # pip install sseclient-py

def stream_pinterest_board(board_url, max_pins=10, num_threads=5, api_url="http://localhost:5000/api/scrape_pinterest"):
    """
    Stream Pinterest board scraping and processing results
    
    Args:
        board_url (str): URL of the Pinterest board to scrape
        max_pins (int): Maximum number of pins to process
        num_threads (int): Number of threads to use for processing
        api_url (str): URL of the streaming API endpoint
    """
    # Prepare the request payload
    payload = {
        "board_url": board_url,
        "max_pins": max_pins,
        "num_threads": num_threads
    }
    
    # Set up headers for SSE
    headers = {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json'
    }
    
    # Make the request and process the SSE stream
    response = requests.post(api_url, json=payload, headers=headers, stream=True)
    client = sseclient.SSEClient(response)
    
    # Process the events
    pins_received = False
    processed_count = 0
    
    for event in client.events():
        data = json.loads(event.data)
        status = data.get('status')
        
        if status == 'pins_scraped':
            pins_received = True
            pins = data.get('pins', [])
            total_pins = data.get('total_pins', 0)
            
            print(f"\n== Initial Pins Scraped ==")
            print(f"Board URL: {data.get('board_url')}")
            print(f"Total pins found: {total_pins}")
            print("Initial pins data received. Creating loading animation...")
            
            # Here the frontend would start showing a loading animation
            for i, pin in enumerate(pins):
                print(f"  Pin {i+1}: {pin.get('title')[:50]}...")
        
        elif status == 'pin_processed':
            processed_count += 1
            processed_pin = data.get('processed_pin')
            
            if processed_pin:
                pin_info = processed_pin[0]['pin'] if processed_pin else None
                if pin_info:
                    print(f"\nProcessed pin {processed_count}: {pin_info.get('title')[:50]}...")
                    print(f"  Found {len(processed_pin)} clothing items")
                    
                    # Here the frontend would update the loading animation with progress
        
        elif status == 'complete':
            print("\n== Processing Complete ==")
            pins = data.get('pins', [])
            print(f"Total processed pins: {len(pins)}")
            
            # Here the frontend would display the final mood board
        
        elif status == 'error':
            print(f"\nError: {data.get('error')}")
            break

def main():
    parser = argparse.ArgumentParser(description='Stream Pinterest board scraping and processing')
    parser.add_argument('board_url', type=str, help='URL of the Pinterest board to scrape')
    parser.add_argument('--max-pins', type=int, default=10, help='Maximum number of pins to process (default: 10)')
    parser.add_argument('--threads', type=int, default=5, help='Number of threads to use for processing (default: 5)')
    parser.add_argument('--api-url', type=str, default='http://localhost:5000/api/scrape_pinterest', 
                        help='URL of the streaming API endpoint')
    
    args = parser.parse_args()
    
    print(f"Starting Pinterest scraper for board: {args.board_url}")
    print(f"Maximum pins to process: {args.max_pins}")
    print(f"Using {args.threads} threads")
    print(f"API URL: {args.api_url}")
    
    # Stream Pinterest board scraping and processing
    stream_pinterest_board(
        board_url=args.board_url,
        max_pins=args.max_pins,
        num_threads=args.threads,
        api_url=args.api_url
    )

if __name__ == "__main__":
    main() 
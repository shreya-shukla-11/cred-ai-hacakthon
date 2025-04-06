import requests
import re
import json
import time
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO
import base64
from tqdm import tqdm
from multiprocessing.pool import ThreadPool
from pydantic import HttpUrl

import get_clothing
import get_llm
import get_embeddings

from milvus.store import MilvusDualClient
from milvus.fetch import MilvusDualSearch



from instagrapi import Client

cl = Client()
cl.login("ayus.hkumar1357", "Yun@1357")
cl.dump_settings("insta_session.json")

cl = Client()
cl.load_settings("insta_session.json")
cl.login("ayus.hkumar1357", "Yun@1357")

def extract_shortcode(insta_url):
    match = re.search(r"instagram\.com/p/([^/]+)/", insta_url)
    return match.group(1) if match else None

def encode_image(image_url):
    """Encode an image from URL to base64"""
    try:
        response = requests.get(image_url, timeout=10)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch image from URL: {image_url}")
        image = Image.open(BytesIO(response.content)).convert("RGB")
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode("utf-8")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Request error for URL {image_url}: {str(e)}")

def scrape_pinterest_board(board_url):
    """Scrape a Pinterest board or Instagram post and return pin/post data"""
    parsed_url = urlparse(board_url)
    if not parsed_url.netloc:
        raise ValueError("Invalid URL - missing domain")
    
    is_pinterest = "pinterest" in parsed_url.netloc or "pin.it" in parsed_url.netloc
    is_instagram = "instagram" in parsed_url.netloc
    
    if not (is_pinterest or is_instagram):
        raise ValueError("Invalid URL - must be from pinterest.com, pin.it, or instagram.com")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    if is_instagram:
        try:
            shortcode = extract_shortcode(board_url)
            if not shortcode:
                raise ValueError("Invalid Instagram post URL.")

            media_pk = cl.media_pk_from_url(board_url)
            media = cl.media_info(media_pk)

            if media.media_type == 8:
                image_url = media.resources[0].thumbnail_url
            elif media.media_type == 1:
                image_url = media.thumbnail_url
            else:
                image_url = media.thumbnail_url

            caption = media.caption_text if media.caption_text else ""
            post_id = str(media.pk)

            if not image_url:
                raise Exception("Could not extract image URL from post")

            print(f"Extracted image URL: {image_url}")

            return [{
                "image_url": str(image_url),
                "title": caption,
                "link": board_url,
                "id": post_id
            }]

        except Exception as e:
            raise Exception(f"Failed to fetch Instagram post: {str(e)}")
    
    if "pin.it" in parsed_url.netloc:
        try:
            response = requests.head(board_url, headers=headers, allow_redirects=True)
            board_url = response.url
            parsed_url = urlparse(board_url)
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to resolve pin.it URL: {str(e)}")

    if not board_url.endswith('/'):
        board_url = board_url + '/'
    
    try:
        response = requests.get(board_url, headers=headers)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to fetch Pinterest board: {str(e)}")
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    script_tags = soup.find_all('script')
    pin_data = []
    
    for script in script_tags:
        if script.string and 'id="initial-state"' in str(script):
            json_text = script.string
            try:
                data = json.loads(json_text)

                resource_response = data.get('resourceResponses', [])
                for response in resource_response:
                    if 'data' in response and 'pins' in response['data']:
                        pins_data = response['data']['pins']
                        for pin in pins_data:
                            if isinstance(pin, dict):
                                pin_info = {
                                    "image_url": pin.get('images', {}).get('236x', {}).get('url', ''),
                                    "title": pin.get('title', ''),
                                    "link": f"https://pinterest.com/pin/{pin.get('id', '')}/",
                                    "id": pin.get('id', ''),
                                }
                                pin_data.append(pin_info)
            except json.JSONDecodeError:
                pass
    
    if not pin_data:
        pin_elements = soup.select('div[data-test-id="pin"]')
        for pin_elem in pin_elements:
            try:
                # Try multiple ways to get pin ID
                pin_id = pin_elem.get('data-pin-id') or \
                         pin_elem.get('data-test-pin-id') or \
                         pin_elem.get('data-id')
                
                if not pin_id:
                    # Try extracting from href if available
                    link = pin_elem.select_one('a[href*="/pin/"]')
                    if link and link.get('href'):
                        pin_id = link['href'].split('/pin/')[-1].split('/')[0]
                
                if not pin_id:
                    continue  # Skip if no pin ID found
                    
                img_tag = pin_elem.select_one('img')
                img_url = img_tag.get('src', '') if img_tag else ''
                title = img_tag.get('alt', '') if img_tag else ''
                
                # Try to find destination link
                link_elem = pin_elem.select_one('a[href*="pinterest.com/pin/"]')
                if link_elem:
                    pin_url = f"https://pinterest.com{link_elem['href']}"
                    try:
                        pin_response = requests.get(pin_url, headers=headers)
                        pin_soup = BeautifulSoup(pin_response.text, 'html.parser')
                    except:
                        pass
                
                pin_info = {
                    "image_url": img_url,
                    "title": title,
                    "link": f"https://pinterest.com/pin/{pin_id}/",
                    "id": pin_id,
                }
                pin_data.append(pin_info)
            except Exception:
                continue
    
    return pin_data

def process_pin(pin, search_client):
    """Process a single Pinterest pin"""
    try:
        # First try to get the image
        try:
            image_b64 = encode_image(pin['image_url'])
        except Exception as e:
            print(f"Error encoding image for pin {pin['id']}: {str(e)}")
            return []

        # Try to detect clothing items
        try:
            cropped_items = get_clothing.detect_clothing_from_file(image_b64)
        except Exception as e:
            print(f"Error detecting clothing for pin {pin['id']}: {str(e)}")
            return []
        
        # If no clothing items were detected, return early
        if not cropped_items:
            print(f"No clothing items detected for pin {pin['id']}")
            return []
            
        processed_items = []

        for idx, item in enumerate(cropped_items):
            try:
                # Get LLM analysis of the clothing item
                llm_result = get_llm.query_litellm(
                    text='',
                    description=pin['title'], 
                    image_base64=item['image']
                )

                # Get embeddings for the item
                img_emb, text_emb = get_embeddings.get_embeddings(
                    item['image'],
                    llm_result['description']
                )

                if img_emb is None or text_emb is None:
                    print(f"Failed to get embeddings for item {idx} in pin {pin['id']}")
                    continue

                # Get category and search for similar items
                category = llm_result.get('dress_category', '')
                results = search_client.search(
                    text_embedding=text_emb,
                    image_embedding=img_emb,
                    top_k=5,
                    text_threshold=0.7,
                    image_threshold=0.7,
                    category=category
                )
                
                # Convert any HttpUrl objects to strings in results
                for result in results:
                    for key, value in result.items():
                        if isinstance(value, HttpUrl):
                            result[key] = str(value)
                
                if len(results) > 0:
                    pin_exists = False
                    for processed_item in processed_items:
                        if processed_item['pin']['id'] == pin['id']:
                            processed_item['detected_items'].append({
                                'text': llm_result.get('short_text', ''),
                                'box': item['box'],
                                'similar_items': results,
                                'similar_items_count': len(results)
                            })
                            pin_exists = True
                            break
                    
                    if not pin_exists:
                        processed_items.append({
                            'pin': pin,
                            'detected_items': [{
                                'text': llm_result.get('short_text', ''), 
                                'box': item['box'],
                                'similar_items': results,
                                'similar_items_count': len(results)
                            }]
                        })
            except Exception as e:
                print(f"Error processing item {idx} for pin {pin['id']}: {str(e)}")
                continue
                
        return processed_items

    except Exception as e:
        print(f"Error processing pin {pin['id']}: {str(e)}")
        return []

def scrape_and_process_pinterest_board(board_url, max_pins=None, num_threads=5):
    
    print(f"Scraping Pinterest board: {board_url}")
    pins = scrape_pinterest_board(board_url)
    
    if max_pins:
        pins = pins[:max_pins]
    
    print(f"Found {len(pins)} pins")
    
    # Create Milvus clients before processing pins
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
    
    print(f"Processing {len(pins)} pins...")
    with ThreadPool(num_threads) as pool:
        results = list(tqdm(
            pool.imap(lambda pin: process_pin(pin, search_client), pins),
            total=len(pins),
            desc="Processing pins"
        ))
    
    # Filter out empty result lists (errors or no detections)
    valid_results = []
    for result in results:
        if result and isinstance(result, list) and len(result) > 0:
            valid_results.extend(result)
    
    return {
        "board_url": board_url,
        "pins": valid_results
    }

if __name__ == "__main__":
    board_url = "https://pin.it/ARFPddKNE"
    results = scrape_and_process_pinterest_board(board_url, max_pins=10)
    
    print(f"Processed {len(results['pins'])} pins")
    print("Results:")
    print(json.dumps(results, indent=2)) 
    print(json.dumps(results, indent=2)) 
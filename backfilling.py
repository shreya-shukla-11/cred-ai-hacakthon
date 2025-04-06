import pandas as pd
import requests
import base64
from PIL import Image
from io import BytesIO
import time
from multiprocessing.pool import ThreadPool
import get_llm
import get_embeddings
import traceback
import os
from tqdm import tqdm
from milvus.store import MilvusDualClient

# Initialize Milvus client
print("Connecting to Milvus...")
milvus_client = MilvusDualClient(
    host="localhost", 
    port="19530", 
    text_collection_name="fashion_items_text", 
    image_collection_name="fashion_items_image"
)

# Load collections once at startup
print("Loading collections...")
try:
    try:
        milvus_client.text_collection.release()
    except Exception as e:
        print(f"Collection release error (expected if not loaded): {str(e)}")
    
    milvus_client.text_collection.load()
    print("Text collection loaded successfully!")
        
except Exception as e:
    print(f"Error during collection loading: {str(e)}")
    print("Continuing with caution - some operations may fail")

def entity_exists(client, product_id):
    try:
        expr = f'product_id == "{product_id}"'
        results = client.text_collection.query(expr, output_fields=["product_id"], limit=1)
        return len(results) > 0
    except Exception as e:
        print(f"Error checking if entity exists for {product_id}: {str(e)}")
        return False

print("Loading product data...")
df = pd.read_csv('fashion_products.csv')
print(f"Loaded {len(df)} products from CSV")

def encode_image(image_url):
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

def process_row(row):
    image_url = row['image']
    try:
        product_id = str(row['product_base_id'])
        
        try:
            if entity_exists(milvus_client, product_id):
                print(f"Product {product_id} already exists in the database. Skipping.")
                return []
        except Exception as e:
            print(f"Error in exists check for {product_id}: {str(e)}")
            print("Continuing with insertion...")
        
        print(f"Processing product {product_id}...")
        
        try:
            image_b64 = encode_image(image_url)
        except Exception as e:
            print(f"Error encoding image for {product_id}: {str(e)}")
            return []
            
        try:
            llm_result = get_llm.query_litellm(
                text=row['description'],
                description=row['description'], 
                image_base64=image_b64
            )

            # if llm_result.get('sanity_check') == 'no':
            #     print(f"Failed sanity check for {product_id}")
            #     return []
            
            img_emb, text_emb = get_embeddings.get_embeddings(
                image_b64,
                llm_result['description']
            )

            if img_emb is None or text_emb is None:
                print(f"Failed to get embeddings for {product_id}")
                return []

            category = llm_result.get('dress_category', 'unknown')
            
            metadata = {
                "link": row['link'],
                "image_url": row['image'],
                "source": row['source'],
                "price": row.get('price', ''),
                "discounted_price": row.get('discounted_price', ''),
                "title": row.get('title', ''),
                "description": row.get('description', ''),
                "brand": row.get('brand_name', ''),
            }

            try:
                milvus_client.insert_entity(product_id, text_emb, img_emb, category, metadata)
                print(f"Successfully inserted {product_id}")
                return [product_id]
            except Exception as e:
                print(f"Error inserting into Milvus for {product_id}: {str(e)}")
                return []
                
        except Exception as e:
            print(f"Error processing {product_id}: {str(e)}")
            return []
    
    except Exception as e:
        print(f"Error processing row {row.name} ({product_id if 'product_id' in locals() else 'unknown ID'})")
        print(traceback.format_exc())
        return []

if not os.path.exists("processed_images"):
    os.makedirs("processed_images")

with ThreadPool(30) as pool:
    results = list(tqdm(
        pool.imap(process_row, [row for _, row in df.iterrows()]), 
        total=len(df),
        desc="Processing products"
    ))

print(f"Processing complete. Successfully processed {sum(1 for r in results if r)} products.")

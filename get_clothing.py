import os
import requests
import base64
import json
from PIL import Image
from io import BytesIO

def detect_clothing_from_file(base64_image, api_url="http://localhost:6000/detect_clothing"):
    # Decode and resize the image to ensure consistent dimensions
    try:
        image_bytes = base64.b64decode(base64_image)
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        
        # Resize to dimensions that work with the model
        # YOLOv8 often uses multiples of 32 for width/height
        # 640x640 is a common input size for YOLOv8
        target_size = (640, 640)
        resized_img = img.resize(target_size, Image.Resampling.LANCZOS)
        
        # Re-encode the resized image
        buffered = BytesIO()
        resized_img.save(buffered, format="JPEG")
        resized_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        # Store original dimensions for scaling bounding boxes back
        original_width, original_height = img.size
    except Exception as e:
        print(f"Error preprocessing image: {str(e)}")
        return []

    payload = {
        "image": resized_base64
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=payload)
        result = response.json()
    except requests.RequestException as e:
        print(f"API connection error: {str(e)}")
        return []
    except json.JSONDecodeError:
        print(f"API returned invalid JSON response: {response.text[:100]}...")
        return []
    
    # If the API returned an error status or message
    if 'error' in result:
        print(f"API Error: {result.get('error')}")
        return []
    
    cropped_items = []
    padding = 5
    
    # Check if 'detections' key exists in the response
    if 'detections' not in result:
        print(f"API Error: 'detections' not found in response. Full response: {result}")
        return []
        
    for item in result['detections']:
        # Scale bounding box back to original image dimensions
        box = item['box']
        x1, y1, x2, y2 = [int(coord) for coord in box]
        
        # Scale coordinates back to original image size
        x1 = int(x1 * original_width / target_size[0])
        y1 = int(y1 * original_height / target_size[1])
        x2 = int(x2 * original_width / target_size[0])
        y2 = int(y2 * original_height / target_size[1])
        
        # Apply padding
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(original_width, x2 + padding)
        y2 = min(original_height, y2 + padding)
        
        # Crop from original image for better quality
        cropped = img.crop((x1, y1, x2, y2))
        
        buffered = BytesIO()
        cropped.save(buffered, format="JPEG")
        cropped_encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        cropped_items.append({
            'box': [x1, y1, x2, y2],  # Use scaled coordinates
            'image': cropped_encoded,
            'confidence': item['confidence']
        })
        
    return cropped_items
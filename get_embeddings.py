import requests
import base64
from PIL import Image
from io import BytesIO

endpoint = "http://newmarqo.runai-modeltest.inferencing.shakticloud.ai"


def get_embeddings(image_b64, text_description):

    try:
        
        payload = {
            "image": image_b64,
            "text": [text_description]
        }
        

        response = requests.post(endpoint, json=payload)
        
        if response.ok:
            data = response.json()
            return data["image_features"], data["text_features"][0]
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return None, None
            
    except Exception as e:
        print(f"Error getting embeddings: {str(e)}")
        return None, None
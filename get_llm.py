import os
import requests
import json 
import re
from typing import Optional, List, Dict, Any, Union

prompt = """You are a fashion image-understanding model.

You will receive an image of a model wearing multiple clothing items along with optional accompanying text. However, only one clothing item (either top or bottom) is being marketed or sold.

Your task is to analyze the provided TEXT and DESCRIPTION to identify which clothing item is being sold (top or bottom), then generate a structured JSON output describing only the clothing item that’s being marketed.

Input format:
TEXT: {{text}}
DESCRIPTION: {{description}}

{{
  "dress_category": choose between only these "top | bottom | one piece | full set",
  "description": "Sub-Category (always add 'jeans/pants' for bottoms that are jeans or pants), Color(s), Pattern(s), Silhouette, Visible Length, Unique Visible Details",
  "short_text": "2 to 3 words that best describe the clothing item being sold"
}}

Important Notes:
	•	dress_category must explicitly be either “top” or “bottom” or “one piece” (1 full body dress) or “full set” (2 things sold together)
	•	The description should:
	•	Clearly specify the sub-category (e.g., jeans/pants for bottom wear if applicable).
	•	Include visible colors, patterns (e.g., floral, plain, striped), silhouette (e.g., straight, skinny, oversized), length (e.g., cropped, full-length, mini), and unique visible details (e.g., frills, buttons, bows, slits, neck or sleeve type).
	•	The short_text must be brief (2-3 words) clearly highlighting key attributes of the marketed item.

Analyze carefully to ensure you describe only the item being marketed based on the provided text and description.
"""

def jsonify(v):
    try:
        json_array_regex = re.compile(r"```json(.*?)```", re.DOTALL)
        matches = json_array_regex.findall(v)

        if not matches:
            object_extract_regex = re.compile(r"(?s)\{.*\}")
            object_regex = re.compile(r",\s*}")
            array_regex = re.compile(r",\s*]")

            matches = object_extract_regex.findall(v)
            if not matches:
                raise ValueError("No valid JSON object found in the input string.")

            v = matches[0]
            v = object_regex.sub("}", v)
            v = array_regex.sub("]", v)
            return json.loads(v)

        json_str = matches[0].strip()
        return json.loads(json_str)

    except Exception as e:
        print(e)
        return None

def query_litellm(
    text: str, 
    description: str,
    image_base64: Optional[str] = None,
    model: str = "claude-3-7-sonnet", 
    api_key: Optional[str] = None,
    api_base: Optional[str] = None
) -> str:

    api_base = "https://api.rabbithole.cred.club"
    api_key = ""
    
    if not api_key:
        raise ValueError("API key is required. Provide it as a parameter or set LITELLM_API_KEY environment variable.")
    
    endpoint = f"{api_base}/v1/chat/completions"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }


    content = [
        {
            "type": "text",
            "text": prompt.format(text=text, description=description)
        },
        {
            "type": "image_url",
            "image_url": {
                "url": "data:image/jpeg;base64," + image_base64
            },
        },
    ]
    
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": content
            }
        ]
    }

    try:
        response = requests.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()  
        result = response.json()

        
        if "choices" in result and len(result["choices"]) > 0:
            message = result["choices"][0]["message"]
            if "content" in message:
                return jsonify(message["content"])
        return result
    
    except requests.exceptions.RequestException as e:
        return f"Error making request: {str(e)}"

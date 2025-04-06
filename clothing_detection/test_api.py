import requests
import base64
import json

# URL of your Flask API
api_url = "http://localhost:6000/detect_clothing"

# Path to test image
image_path = "pin_703124560610723695.jpg"

# Read and encode image
with open(image_path, "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

# Prepare payload
payload = {
    "image": encoded_string
}

# Send request
headers = {
    "Content-Type": "application/json"
}

print("Sending request to detect clothing in image...")
response = requests.post(api_url, headers=headers, json=payload)

# Print response details
print(f"Status code: {response.status_code}")
print(f"Response headers: {response.headers}")
print(f"Response content: {response.text}")

# Try to parse JSON response if available
try:
    json_response = response.json()
    print("Response JSON:")
    print(json.dumps(json_response, indent=4))
except Exception as e:
    print(f"Error parsing JSON: {e}")

# # Generate the curl command equivalent
# curl_command = f"""
# curl -X POST {api_url} \\
#   -H "Content-Type: application/json" \\
#   -d '{{"image": "{encoded_string[:20]}...{encoded_string[-20:]}"}}' 
# """

# print("\nEquivalent curl command (image data truncated for readability):")
# print(curl_command)
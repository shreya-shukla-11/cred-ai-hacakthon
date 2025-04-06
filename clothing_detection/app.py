import os
import base64
import io
from PIL import Image
import json
from flask import Flask, request, jsonify
from huggingface_hub import hf_hub_download
from ultralytics import YOLO

app = Flask(__name__)

model_path = hf_hub_download(repo_id="kesimeg/yolov8n-clothing-detection", 
                             filename="best.pt",
                             force_download=True) 
print(f"Model path: {model_path}")

MODEL = YOLO(model_path)
print("Successfully loaded custom clothing detection model")

@app.route('/detect_clothing', methods=['POST'])
def detect_clothing():
    data = request.json
    
    if not data or 'image' not in data:
        return jsonify({"error": "No image provided"}), 400
    
    try:
        base64_image = data['image']
        if 'data:image' in base64_image:
            base64_image = base64_image.split(',')[1]
        
        try:
            image_bytes = base64.b64decode(base64_image)
            img = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return jsonify({"error": f"Invalid base64 image: {str(e)}"}), 400
        
        results = MODEL.predict(img)
        result = results[0]
        
        boxes = []
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            
            # If class is clothing item (class 2)
            if cls == 2:
                boxes.append({
                    'box': [x1, y1, x2, y2],
                    'confidence': round(conf, 2),
                })
        
        return jsonify({
            "success": True,
            "items_detected": len(boxes),
            "detections": boxes
        })
    
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=6000) 
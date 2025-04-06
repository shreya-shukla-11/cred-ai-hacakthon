# store.py
import numpy as np
from pymilvus import (
    connections,
    utility,
    FieldSchema,
    CollectionSchema,
    DataType,
    Collection,
)

class MilvusDualClient:
    def __init__(
        self,
        host="localhost",
        port="19530",
        text_collection_name="fashion_items_text",
        image_collection_name="fashion_items_image"
    ):
        self.text_collection_name = text_collection_name
        self.image_collection_name = image_collection_name
        self.dimension = 768
        self.connect_to_milvus(host, port)
        self.text_collection = self.create_text_collection_if_not_exists()
        self.image_collection = self.create_image_collection_if_not_exists()
        
    def connect_to_milvus(self, host, port):
        # Update host if accessing from a remote machine (e.g. EC2 public IP)
        connections.connect("default", host=host, port=port)
        print(f"Connected to Milvus server at {host}:{port}")
        
    def create_text_collection_if_not_exists(self):
        if utility.has_collection(self.text_collection_name):
            print(f"Collection '{self.text_collection_name}' already exists.")
            return Collection(self.text_collection_name)
        
        fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
            FieldSchema(name="product_id", dtype=DataType.VARCHAR, max_length=100),
            FieldSchema(name="text_embedding", dtype=DataType.FLOAT_VECTOR, dim=self.dimension),
            FieldSchema(name="category", dtype=DataType.VARCHAR, max_length=100),
            FieldSchema(name="metadata", dtype=DataType.JSON)
        ]
        schema = CollectionSchema(fields=fields, description="Fashion items text embeddings")
        collection = Collection(name=self.text_collection_name, schema=schema)
        index_params = {
            "metric_type": "COSINE",
            "index_type": "HNSW",
            "params": {"M": 8, "efConstruction": 64}
        }
        collection.create_index(field_name="text_embedding", index_params=index_params)
        # Create index on category field if needed for filtering
        collection.create_index(field_name="category", index_name="category_idx")
        print(f"Created text collection '{self.text_collection_name}' with indexes.")
        return collection

    def create_image_collection_if_not_exists(self):
        if utility.has_collection(self.image_collection_name):
            print(f"Collection '{self.image_collection_name}' already exists.")
            return Collection(self.image_collection_name)
        
        fields = [
            FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
            FieldSchema(name="product_id", dtype=DataType.VARCHAR, max_length=100),
            FieldSchema(name="image_embedding", dtype=DataType.FLOAT_VECTOR, dim=self.dimension),
            FieldSchema(name="category", dtype=DataType.VARCHAR, max_length=100),
            FieldSchema(name="metadata", dtype=DataType.JSON)
        ]
        schema = CollectionSchema(fields=fields, description="Fashion items image embeddings")
        collection = Collection(name=self.image_collection_name, schema=schema)
        index_params = {
            "metric_type": "COSINE",
            "index_type": "HNSW",
            "params": {"M": 8, "efConstruction": 64}
        }
        collection.create_index(field_name="image_embedding", index_params=index_params)
        collection.create_index(field_name="category", index_name="category_idx")
        print(f"Created image collection '{self.image_collection_name}' with indexes.")
        return collection

    def insert_entity(self, product_id, text_embedding, image_embedding, category, metadata):
        # Insert into text collection
        text_entities = [
            [product_id],           # product_id
            [text_embedding],       # text_embedding (list of 768 floats)
            [category],             # category prefilter
            [metadata]              # metadata (JSON)
        ]
        text_result = self.text_collection.insert(text_entities)
        self.text_collection.flush()
        
        # Insert into image collection
        image_entities = [
            [product_id],           # product_id
            [image_embedding],      # image_embedding (list of 768 floats)
            [category],             # category prefilter
            [metadata]              # metadata (JSON)
        ]
        image_result = self.image_collection.insert(image_entities)
        self.image_collection.flush()
        
        print(f"Inserted entity with product ID: {product_id} into both text and image collections.")
        return text_result, image_result

    def upsert_entity(self, product_id, text_embedding, image_embedding, category, metadata):
        """
        Upsert an entity: If an entity with the given product_id exists,
        delete it from both collections before inserting the new data.
        """
        expr = f'product_id == "{product_id}"'
        print(f"Upsert: Deleting existing records with product_id: {product_id}")
        
        # Delete from text collection
        self.text_collection.delete(expr)
        self.text_collection.flush()
        
        # Delete from image collection
        self.image_collection.delete(expr)
        self.image_collection.flush()
        
        # Insert the new record
        return self.insert_entity(product_id, text_embedding, image_embedding, category, metadata)
    
    def drop_collections(self):
        """Drop both collections."""
        utility.drop_collection(self.text_collection_name)
        utility.drop_collection(self.image_collection_name)
        print(f"Dropped collections '{self.text_collection_name}' and '{self.image_collection_name}'.")
        
    def close(self):
        """Disconnect from Milvus."""
        connections.disconnect("default")
        print("Disconnected from Milvus server.")
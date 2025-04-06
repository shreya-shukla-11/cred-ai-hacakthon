# fetch_dual.py
import numpy as np
from pymilvus import Collection
from typing import List, Dict, Any, Union, Optional

class MilvusDualSearch:
    def __init__(
        self,
        text_collection: Collection,
        image_collection: Collection,
        text_weight: float = 0.5,
        image_weight: float = 0.5
    ):
        """
        Initialize the dual search client with separate collections.
        
        Args:
            text_collection: Milvus Collection object storing text embeddings.
            image_collection: Milvus Collection object storing image embeddings.
            text_weight: Weight for text similarity.
            image_weight: Weight for image similarity.
        """
        self.text_collection = text_collection
        self.image_collection = image_collection
        self.text_weight = text_weight
        self.image_weight = image_weight

    def search(
        self,
        text_embedding: Union[List[float], np.ndarray],
        image_embedding: Union[List[float], np.ndarray],
        top_k: int = 10,
        text_threshold: float = 0.1,
        image_threshold: float = 0.1,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        # Ensure minimum of 5 results
        top_k = max(top_k, 5)
        
        # Prepare embeddings as 2D arrays for search
        text_embedding = self._prepare_embedding(text_embedding)
        image_embedding = self._prepare_embedding(image_embedding)
        
        # Load both collections into memory
        self.text_collection.load()
        self.image_collection.load()
        
        search_params = {"metric_type": "COSINE", "params": {"ef": 250}}
        expr = f'category == "{category}"' if category else None
        output_fields = ["product_id", "category", "metadata"]

        # Search text collection with higher limit to ensure enough matches
        text_results = self.text_collection.search(
            data=text_embedding,
            anns_field="text_embedding",
            param=search_params,
            limit=max(top_k * 20, 200),  # Increased limit for more potential matches
            expr=expr,
            output_fields=output_fields
        )

        # Search image collection with higher limit
        image_results = self.image_collection.search(
            data=image_embedding,
            anns_field="image_embedding",
            param=search_params,
            limit=max(top_k * 20, 200),  # Increased limit for more potential matches
            expr=expr,
            output_fields=output_fields
        )
        
        # Extract results from each search
        text_search_results = []
        for hits in text_results:
            for hit in hits:
                if hit.score >= text_threshold:  # Apply threshold during extraction
                    text_search_results.append({
                        'product_id': hit.entity.product_id,
                        'category': hit.entity.category,
                        'metadata': hit.entity.metadata,
                        'score': hit.score
                    })

        image_search_results = []
        for hits in image_results:
            for hit in hits:
                if hit.score >= image_threshold:  # Apply threshold during extraction
                    image_search_results.append({
                        'product_id': hit.entity.product_id,
                        'category': hit.entity.category,
                        'metadata': hit.entity.metadata,
                        'score': hit.score
                    })

        # Create product ID to result mapping for faster lookup
        image_results_map = {r['product_id']: r for r in image_search_results}
        
        # Combine results based on product_id
        combined_results = []
        for text_result in text_search_results:
            product_id = text_result['product_id']
            if product_id in image_results_map:
                image_result = image_results_map[product_id]
                combined_score = (self.text_weight * text_result['score'] + 
                                self.image_weight * image_result['score'])
                
                combined_results.append({
                    'product_id': product_id,
                    'category': text_result['category'],
                    'metadata': text_result['metadata'],
                    'text_score': text_result['score'],
                    'image_score': image_result['score'],
                    'combined_score': combined_score
                })
        
        # Sort by combined score
        sorted_results = sorted(combined_results, key=lambda x: x['combined_score'], reverse=True)
        
        # If we have less than 5 results, add more from text_search_results
        if len(sorted_results) < 5:
            remaining_needed = 5 - len(sorted_results)
            for text_result in text_search_results:
                if len(sorted_results) >= 5:
                    break
                    
                product_id = text_result['product_id']
                if product_id not in [r['product_id'] for r in sorted_results]:
                    sorted_results.append({
                        'product_id': product_id,
                        'category': text_result['category'],
                        'metadata': text_result['metadata'],
                        'text_score': text_result['score'],
                        'image_score': 0.0,
                        'combined_score': self.text_weight * text_result['score']
                    })
                    
        # Return at least 5 results, but no more than top_k
        return sorted_results[0:max(top_k, 5)]

    def _prepare_embedding(self, embedding: Union[List[float], np.ndarray]) -> np.ndarray:
        """Ensure embedding is a 2D numpy array."""
        if not isinstance(embedding, np.ndarray):
            embedding = np.array(embedding)
        if len(embedding.shape) == 1:
            embedding = embedding.reshape(1, -1)
        return embedding

    def hybrid_search(
        self,
        text_embedding: Union[List[float], np.ndarray],
        image_embedding: Union[List[float], np.ndarray],
        query_text: str = None,
        top_k: int = 10,
        text_threshold: float = 0.7,
        image_threshold: float = 0.7,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform a hybrid search that incorporates keyword matching over metadata.
        """
        # Ensure minimum of 5 results
        top_k = max(top_k, 5)
        
        results = self.search(
            text_embedding=text_embedding,
            image_embedding=image_embedding,
            top_k=top_k,
            text_threshold=text_threshold,
            image_threshold=image_threshold,
            category=category
        )
        
        if query_text and results:
            for result in results:
                description = result.get('metadata', {}).get('description', '').lower()
                query_terms = query_text.lower().split()
                text_match_score = sum(term in description for term in query_terms) / len(query_terms) if query_terms else 0
                result['combined_score'] = 0.8 * result['combined_score'] + 0.2 * text_match_score
            results = sorted(results, key=lambda x: x['combined_score'], reverse=True)
            
        return results[0:max(top_k, 5)]
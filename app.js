document.addEventListener('DOMContentLoaded', () => {
    const pinterestUrlInput = document.getElementById('pinterest-url');
    const generateBtn = document.getElementById('generate-btn');
    const searchContainer = document.getElementById('search-container');
    const loadingContainer = document.getElementById('loading-container');
    const loadingAnimation = document.getElementById('loading-animation');
    const loadingStatus = document.getElementById('loading-status');
    const resultsContainer = document.getElementById('results-container');
    const moodBoard = document.getElementById('mood-board');

    // Debug log
    console.log('Frontend app initialized');
    console.log('DOM elements loaded:', {
        pinterestUrlInput: !!pinterestUrlInput,
        generateBtn: !!generateBtn,
        searchContainer: !!searchContainer,
        loadingContainer: !!loadingContainer,
        loadingAnimation: !!loadingAnimation,
        loadingStatus: !!loadingStatus,
        resultsContainer: !!resultsContainer,
        moodBoard: !!moodBoard
    });

    // API URL - using the server's actual IP address instead of hostname
    // Replace 10.1.17.79 with your actual server IP address if different
    const API_URL = '/api/scrape_pinterest';
    console.log(`Using API URL: ${API_URL}`);
    
    let initialPins = [];
    let processedPins = [];

    // Helper function to create loading animation
    function createLoadingAnimation(pins) {
        loadingAnimation.innerHTML = '';
        console.log('Creating loading animation with pins:', pins);
        
        pins.forEach(pin => {
            if (pin.image_url) {
                const img = document.createElement('img');
                img.src = pin.image_url;
                img.alt = pin.title || 'Pinterest image';
                img.className = 'loading-image';
                loadingAnimation.appendChild(img);
            }
        });
    }

    // Helper function to create the mood board
    function createMoodBoard(processedPins) {
        moodBoard.innerHTML = '';
        console.log('Creating mood board with processed pins:', processedPins);
        
        // First ensure we have the right data structure
        if (!processedPins || !Array.isArray(processedPins) || processedPins.length === 0) {
            console.error('No valid pins data to display');
            
            // Show error message in the mood board
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = 'No pins data available to display.';
            moodBoard.appendChild(errorMessage);
            return;
        }
        
        console.log('Pins array type:', typeof processedPins);
        console.log('Pins array length:', processedPins.length);
        console.log('First element type:', typeof processedPins[0]);
        
        // Normalize the pin data structure
        let pinsToRender = [];
        
        // Check if we have a nested array structure like [[pin1, pin2, ...]]
        if (Array.isArray(processedPins[0]) && processedPins.length === 1) {
            console.log('Detected nested array structure, extracting inner array');
            pinsToRender = processedPins[0];
        } 
        // Check if each item is already a valid pin
        else if (processedPins[0] && processedPins[0].pin) {
            console.log('Detected array of pin objects');
            pinsToRender = processedPins;
        }
        // Array might contain an array of pins
        else if (Array.isArray(processedPins[0])) {
            console.log('Found array of arrays, flattening');
            // Flatten the array of arrays
            pinsToRender = processedPins.flat();
        }
        
        console.log('Pre-sorted pins:', pinsToRender);
        
        // Filter out invalid pins
        pinsToRender = pinsToRender.filter(pin => pin && pin.pin);
        
        // Sort pins by the number of similar items (descending)
        pinsToRender.sort((a, b) => {
            const aCount = a.similar_items && Array.isArray(a.similar_items) ? a.similar_items.length : 0;
            const bCount = b.similar_items && Array.isArray(b.similar_items) ? b.similar_items.length : 0;
            return bCount - aCount; // Descending order (most similar items first)
        });
        
        console.log('Sorted pins by similar item count:', pinsToRender);
        console.log('Number of pins to render:', pinsToRender.length);
        
        // Create a row for each pin and its similar items
        pinsToRender.forEach((processedPin, index) => {
            console.log(`Rendering pin ${index} with ${processedPin.similar_items?.length || 0} similar items:`, processedPin);
            renderSinglePin(processedPin, index);
        });
        
        console.log('Mood board creation completed');
        
        // Add a note about using the mood board
        const usageNote = document.createElement('div');
        usageNote.className = 'usage-note';
        usageNote.innerHTML = `
            <p>Click on any product to view it on the retailer's website.</p>
            <p>All prices shown are in Indian Rupees (₹).</p>
            <p>Pins are ranked by the number of similar items found.</p>
        `;
        moodBoard.appendChild(usageNote);
    }
    
    // Helper function to render a single pin
    function renderSinglePin(processedPin, index) {
        console.log(`Rendering single pin ${index}:`, processedPin);
        
        if (!processedPin || !processedPin.pin) {
            console.warn('Skipping invalid pin data in renderSinglePin:', processedPin);
            return;
        }
        
        // Create the overall pin container
        const pinContainer = document.createElement('div');
        pinContainer.className = 'pin-container';
        pinContainer.id = `pin-container-${index}`;
        
        // For desktop view, create a container for the Pinterest image that will be shared across all rails
        const pinImageOuterContainer = document.createElement('div');
        pinImageOuterContainer.className = 'pin-image-outer-container';
        
        // Create the Pinterest image container
        const pinImageContainer = document.createElement('div');
        pinImageContainer.className = 'pin-image-container';
        
        // Create clickable link for the Pinterest image
        const pinImageLink = document.createElement('a');
        pinImageLink.href = processedPin.pin.link || '#';
        pinImageLink.target = '_blank';
        pinImageLink.className = 'pin-image-link';
        pinImageLink.title = 'View on Pinterest';
        pinImageLink.style.textDecoration = 'none';
        pinImageLink.style.color = 'inherit';
        pinImageLink.setAttribute('rel', 'noopener');
        
        const pinImage = document.createElement('img');
        pinImage.src = processedPin.pin.image_url;
        pinImage.alt = processedPin.text || processedPin.pin.title || 'Pinterest image';
        pinImage.className = 'pin-image';
        
        // Add error handling for image loading
        pinImage.onerror = function() {
            this.src = 'https://via.placeholder.com/300x400/eeeeee/999999?text=Image+Unavailable';
        };
        
        pinImageLink.appendChild(pinImage);
        pinImageContainer.appendChild(pinImageLink);
        
        // Add highlight box if box coordinates are available
        if (processedPin.box && Array.isArray(processedPin.box) && processedPin.box.length === 4 && 
            !processedPin.box.every(coord => coord === 0)) { // Skip if all coords are 0
            console.log(`Pin ${index} has box coordinates:`, processedPin.box);
            
            // Wait for the image to load to get its dimensions
            pinImage.onload = function() {
                const imgWidth = this.width;
                const imgHeight = this.height;
                
                // Box coordinates are typically [x1, y1, x2, y2] in normalized format (0-1)
                const [x1, y1, x2, y2] = processedPin.box;
                
                // Create highlight box element
                const highlightBox = document.createElement('div');
                highlightBox.className = 'highlight-box';
                
                // Convert normalized coordinates to pixel values
                highlightBox.style.left = `${x1 * imgWidth}px`;
                highlightBox.style.top = `${y1 * imgHeight}px`;
                highlightBox.style.width = `${(x2 - x1) * imgWidth}px`;
                highlightBox.style.height = `${(y2 - y1) * imgHeight}px`;
                
                // Add the highlight box to the pin image container
                pinImageLink.appendChild(highlightBox);
            };
        }
        
        // Add the Pinterest image container to the outer container
        pinImageOuterContainer.appendChild(pinImageContainer);
        
        // Add the Pinterest image outer container to the pin container
        pinContainer.appendChild(pinImageOuterContainer);
        
        // Check if we have detected items - the new structure
        if (processedPin.detected_items && Array.isArray(processedPin.detected_items)) {
            console.log(`Pin ${index} has ${processedPin.detected_items.length} detected items`);
            
            // For each detected item, create a flex row with the heading and rail
            processedPin.detected_items.forEach((detectedItem, itemIndex) => {
                // Create a flex container for this row (side by side layout in desktop)
                const flexContainer = document.createElement('div');
                flexContainer.className = 'flex-container';
                
                // Create a section for this detected item
                const itemSection = document.createElement('div');
                itemSection.className = 'detected-item-section';
                
                // Add the item title as a heading above the similar items
                const itemHeading = document.createElement('h3');
                itemHeading.className = 'item-heading';
                itemHeading.textContent = detectedItem.text || `Item ${itemIndex + 1}`;
                
                // Create the container for similar items
                const similarItemsContainer = document.createElement('div');
                similarItemsContainer.className = 'similar-items-container';
                
                const similarItems = document.createElement('div');
                similarItems.className = 'similar-items';
                similarItems.dataset.itemIndex = itemIndex;
                
                // Add similar items if available
                if (detectedItem.similar_items && Array.isArray(detectedItem.similar_items) && detectedItem.similar_items.length > 0) {
                    console.log(`Adding ${detectedItem.similar_items.length} similar items for detected item ${itemIndex}`);
                    
                    detectedItem.similar_items.forEach((similarItem, idx) => {
                        // Skip invalid items
                        if (!similarItem || !similarItem.metadata) {
                            console.warn(`Skipping invalid similar item ${idx} for detected item ${itemIndex}:`, similarItem);
                            return;
                        }
                        
                        // Create product card
                        const productLink = createSimilarItemCard(similarItem, idx);
                        similarItems.appendChild(productLink);
                    });
                } else {
                    console.log(`No similar items found for detected item ${itemIndex}, adding fallback message`);
                    
                    // Create fallback message
                    const fallbackMessage = document.createElement('div');
                    fallbackMessage.className = 'fallback-note';
                    fallbackMessage.textContent = 'No similar items found for this item.';
                    similarItems.appendChild(fallbackMessage);
                    
                    // Add some fallback placeholder items
                    addFallbackItems(similarItems, detectedItem.text || 'Similar style');
                }
                
                similarItemsContainer.appendChild(similarItems);
                
                // For mobile: Add the heading to the item section first
                itemSection.appendChild(itemHeading);
                
                // Then add the similar items container
                itemSection.appendChild(similarItemsContainer);
                
                // Add the item section to the flex container
                flexContainer.appendChild(itemSection);
                
                // Add the flex container to the pin container
                pinContainer.appendChild(flexContainer);
            });
        } else if (processedPin.similar_items) {
            // Handle legacy structure with a single similar items array
            console.log(`Pin ${index} has legacy structure with ${processedPin.similar_items.length} similar items`);
            
            // Create flex container for side by side layout in desktop
            const flexContainer = document.createElement('div');
            flexContainer.className = 'flex-container';
            
            // Create a container section for legacy format
            const itemSection = document.createElement('div');
            itemSection.className = 'detected-item-section';
            
            // Add the title as a heading
            const pinTitle = document.createElement('h3');
            pinTitle.className = 'item-heading'; // Use the item-heading class for consistency
            
            // Check if the processedPin has a 'text' field (from LLM description)
            if (processedPin.text) {
                console.log('Using processed text for pin title:', processedPin.text);
                pinTitle.textContent = processedPin.text;
            } else {
                // Fall back to the original pin title
                pinTitle.textContent = processedPin.pin.title || 'Pinterest Pin';
            }
            
            // Create the container for similar items
            const similarItemsContainer = document.createElement('div');
            similarItemsContainer.className = 'similar-items-container';
            
            const similarItems = document.createElement('div');
            similarItems.className = 'similar-items';
            
            // Add similar items
            if (processedPin.similar_items && Array.isArray(processedPin.similar_items) && processedPin.similar_items.length > 0) {
                console.log(`Adding ${processedPin.similar_items.length} similar items to pin ${index}`);
                processedPin.similar_items.forEach((similarItem, idx) => {
                    // Skip invalid items
                    if (!similarItem || !similarItem.metadata) {
                        console.warn(`Skipping invalid similar item ${idx} for pin ${index}:`, similarItem);
                        return;
                    }
                    
                    // Create product card
                    const productLink = createSimilarItemCard(similarItem, idx);
                    similarItems.appendChild(productLink);
                });
            } else {
                console.log(`No similar items found for pin ${index}, adding fallback message`);
                
                // Create fallback message
                const fallbackMessage = document.createElement('div');
                fallbackMessage.className = 'fallback-note';
                fallbackMessage.textContent = 'No similar items found for this pin.';
                similarItems.appendChild(fallbackMessage);
                
                // Add some fallback placeholder items
                addFallbackItems(similarItems, processedPin.pin.title || 'Similar style');
            }
            
            similarItemsContainer.appendChild(similarItems);
            
            // Add title above the rail (for mobile view)
            itemSection.appendChild(pinTitle);
            itemSection.appendChild(similarItemsContainer);
            
            // Add the item section to the flex container
            flexContainer.appendChild(itemSection);
            
            // Add the flex container to the pin container
            pinContainer.appendChild(flexContainer);
        }
        
        // Add to the mood board
        moodBoard.appendChild(pinContainer);
        console.log('Added pin container to mood board for pin', index);
    }

    // Simple fetch function that handles CORS and errors
    async function fetchWithRetry(url, options, retries = 3) {
        try {
            console.log(`Fetching ${url} with options:`, options);
            const response = await fetch(url, {
                ...options,
                mode: 'cors', // Explicitly set CORS mode
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            if (retries > 0) {
                console.warn(`Fetch error: ${error.message}. Retrying... (${retries} attempts left)`);
                // Wait a short time before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    // Function to handle the streaming events using direct fetch
    async function streamPinterestBoard(boardUrl) {
        // Reset state
        initialPins = [];
        processedPins = [];
        
        // Remove any existing spacer
        const existingSpacer = document.getElementById('search-container-spacer');
        if (existingSpacer) {
            existingSpacer.remove();
        }
        
        // No longer need to remove moved-up class since we're not using it
        // searchContainer.classList.remove('moved-up');
        
        loadingContainer.style.display = 'block';
        resultsContainer.style.display = 'none';
        
        // Empty loading status text
        loadingStatus.textContent = '';
        
        console.log('Attempting to connect to:', API_URL);
        console.log('With board URL:', boardUrl);
        
        try {
            // Make the POST request to start streaming
            const response = await fetchWithRetry(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    board_url: boardUrl,
                    max_pins: 10,
                    num_threads: 5
                }),
                credentials: 'omit' // Don't send cookies
            });
            
            console.log('Connected to server, response:', response);
            loadingStatus.textContent = 'Connected to server. Waiting for data...';
            
            // Read and process the stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('Stream closed by server');
                    break;
                }
                
                // Decode and process the chunk
                const chunk = decoder.decode(value, { stream: true });
                console.log('Received chunk:', chunk);
                buffer += chunk;
                
                // Process complete SSE events (separated by double newlines)
                const events = buffer.split('\n\n');
                buffer = events.pop(); // Keep the last incomplete chunk in the buffer
                
                for (const event of events) {
                    // Check if the event starts with 'data: '
                    if (event.startsWith('data: ')) {
                        try {
                            // Extract everything after 'data: '
                            const dataString = event.substring(6).trim();
                            
                            // Skip empty data
                            if (!dataString) {
                                console.log('Empty event data, ignoring');
                                continue;
                            }
                            
                            try {
                                // Try to parse the data string as JSON
                                // First handle NaN values which are not valid in JSON
                                const sanitizedDataString = dataString.replace(/"description":\s*NaN/g, '"description": null');
                                const data = JSON.parse(sanitizedDataString);
                                console.log('Parsed event data:', data);
                                handleStreamEvent(data);
                            } catch (jsonError) {
                                // If JSON parsing fails, try to reconstruct fragmented JSON
                                console.warn('JSON parse error, trying to fix malformed JSON:', jsonError);
                                
                                // For 'complete_pin' events which might be huge
                                if (dataString.includes('"status":"complete_pin"')) {
                                    console.log('Detected complete_pin event, attempting to extract data');
                                    
                                    // Get basic info
                                    const match = dataString.match(/"pin_index":\s*(\d+),\s*"total_pins":\s*(\d+)/);
                                    if (match) {
                                        const pinIndex = parseInt(match[1]);
                                        const totalPins = parseInt(match[2]);
                                        
                                        // Manual extraction of pin data
                                        if (!window.completePins) {
                                            window.completePins = [];
                                        }
                                        
                                        // Try to extract pin data from the string
                                        const pinData = extractPinDataFromString(dataString);
                                        
                                        if (pinData) {
                                            console.log(`Successfully extracted basic pin data for pin ${pinIndex + 1}/${totalPins}`);
                                            window.completePins.push(pinData);
                                        } else {
                                            // Add a placeholder if extraction fails
                                            window.completePins.push({
                                                pin: {
                                                    image_url: 'https://i.pinimg.com/236x/8f/0b/8c/8f0b8c3a5d03ad87bfc01f06430e331a.jpg',
                                                    title: `Pin ${pinIndex + 1}`,
                                                    link: '#',
                                                    id: ''
                                                },
                                                box: [0, 0, 0, 0],
                                                similar_items: []
                                            });
                                        }
                                        
                                        // Update loading message
                                        const loadingMessage = moodBoard.querySelector('.loading-message');
                                        if (loadingMessage) {
                                            loadingMessage.textContent = `Building mood board... ${pinIndex + 1}/${totalPins} pins`;
                                        }
                                    }
                                } else {
                                    console.error('Failed to parse event data:', jsonError, 'Raw data:', dataString);
                                }
                            }
                        } catch (e) {
                            console.error('Error processing event:', e, 'Raw event:', event);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Stream error:', error);
            loadingStatus.textContent = `Error: ${error.message}`;
            
            // Display error details for debugging
            const errorDetails = document.createElement('div');
            errorDetails.style.marginTop = '20px';
            errorDetails.style.color = 'red';
            errorDetails.style.textAlign = 'left';
            errorDetails.innerHTML = `
                <strong>Error Details:</strong><br>
                ${error.stack ? error.stack.replace(/\n/g, '<br>') : error.message}
                <br><br>
                <strong>Troubleshooting:</strong><br>
                - Check if the backend server is running at ${API_URL}<br>
                - Check browser console for CORS errors<br>
                - Verify the backend has CORS enabled<br>
                - Try disabling browser security for testing (not recommended for production)
            `;
            loadingAnimation.innerHTML = '';
            loadingAnimation.appendChild(errorDetails);
        }
    }
    
    // Function to handle the different events from the stream
    function handleStreamEvent(data) {
        const status = data.status;
        console.log('Handling event with status:', status);
        
        if (status === 'pins_scraped') {
            // First event: We have the initial pins
            initialPins = data.pins;
            loadingStatus.textContent = '';
            
            // Create the loading animation with the initial pins
            createLoadingAnimation(initialPins);
        }
        else if (status === 'pin_processed') {
            // A pin has been processed
            const processedPin = data.processed_pin;
            if (processedPin) {
                processedPins.push(processedPin);
                loadingStatus.textContent = '';
            }
        }
        // Handle chunked completion events
        else if (status === 'complete_start') {
            // The start of the completion sequence
            console.log('Starting to receive final results.');
            loadingStatus.textContent = '';
            
            // Reset any existing collection of complete pins
            window.completePins = [];
            
            // Switch to results view to prepare for pins
            loadingContainer.style.display = 'none';
            resultsContainer.style.display = 'block';
            moodBoard.innerHTML = '';
        }
        else if (status === 'complete_pin') {
            // A pin from the final results
            console.log(`Received pin ${data.pin_index + 1}/${data.total_pins}`);
            
            // Store the pin data
            if (!window.completePins) {
                window.completePins = [];
            }
            
            // Ensure box coordinates are properly extracted
            if (data.pin_data && data.pin_data.box) {
                console.log('Pin has box coordinates:', data.pin_data.box);
            } else if (data.pin_data) {
                // If box coordinates are missing, try to find them in the raw response
                console.log('Pin is missing box coordinates, checking raw data');
                
                // Try to extract box from the full data string if available
                const dataString = JSON.stringify(data);
                const boxMatch = dataString.match(/"box":\s*\[([^\]]+)\]/);
                if (boxMatch && boxMatch[1]) {
                    // Extract the coordinates and convert to numbers
                    const boxCoords = boxMatch[1].split(',').map(coord => parseFloat(coord.trim()));
                    if (boxCoords.length === 4 && !boxCoords.some(isNaN)) {
                        data.pin_data.box = boxCoords;
                        console.log('Found and added box coordinates:', boxCoords);
                    }
                }
            }
            
            // Ensure similar_items exists
            if (data.pin_data && !data.pin_data.similar_items) {
                console.warn('Adding missing similar_items array to pin data');
                data.pin_data.similar_items = [];
            }
            
            window.completePins.push(data.pin_data);
            
            // Update the loading message - remove text
            const loadingMessage = moodBoard.querySelector('.loading-message');
            if (loadingMessage) {
                loadingMessage.remove();
            }
        }
        else if (status === 'complete_end') {
            // All pins received, now create the mood board
            console.log('All pins received. Creating mood board.');
            loadingStatus.textContent = '';
            
            // Create the mood board with the collected pins
            if (window.completePins && window.completePins.length > 0) {
                console.log(`Creating mood board with ${window.completePins.length} pins`);
                // Pass the pins directly rather than nesting them in another array
                createMoodBoard(window.completePins);
                console.log('Mood board created and displayed!');
            } else {
                console.log('No complete pins available.');
                
                // Display error message in mood board
                const errorMessage = document.createElement('div');
                errorMessage.className = 'error-message';
                errorMessage.innerHTML = `
                    <p>No pins could be processed from this board.</p>
                    <p>Please try a different Pinterest board URL.</p>
                `;
                moodBoard.appendChild(errorMessage);
            }
        }
        // Handle the old single-message complete event for backward compatibility
        else if (status === 'complete') {
            // All pins have been processed
            console.log('Processing complete. Creating mood board with data:', data);
            loadingStatus.textContent = '';
            
            // Make sure we have pins data in the expected format
            if (data.pins && Array.isArray(data.pins)) {
                // Switch to results view FIRST
                loadingContainer.style.display = 'none';
                resultsContainer.style.display = 'block';
                
                // Force layout update
                setTimeout(() => {
                    // Create the final mood board
                    createMoodBoard(data.pins);
                    console.log('Mood board created and displayed!');
                }, 100);
            } else {
                console.error('Invalid pins data format:', data.pins);
                loadingStatus.textContent = '';
                
                // Show error message in results container
                resultsContainer.style.display = 'block';
                moodBoard.innerHTML = `
                    <div class="error-message">
                        <p>Error: Unable to display mood board. Invalid data format received.</p>
                        <p>Check the browser console for details.</p>
                    </div>
                `;
                
                // Also display raw data for debugging
                const rawDataContainer = document.createElement('pre');
                rawDataContainer.textContent = JSON.stringify(data, null, 2);
                rawDataContainer.style.maxHeight = '300px';
                rawDataContainer.style.overflow = 'auto';
                rawDataContainer.style.backgroundColor = '#f5f5f5';
                rawDataContainer.style.padding = '10px';
                rawDataContainer.style.marginTop = '20px';
                rawDataContainer.style.fontSize = '12px';
                moodBoard.appendChild(rawDataContainer);
            }
        }
        else if (status === 'error') {
            // Error occurred
            console.error('Error from server:', data.error);
            loadingStatus.textContent = '';
        }
    }

    // Event listener for the generate button
    generateBtn.addEventListener('click', () => {
        const boardUrl = pinterestUrlInput.value.trim();
        
        if (!boardUrl) {
            alert('Please enter a Pinterest board URL');
            return;
        }
        
        console.log('Generate clicked with URL:', boardUrl);
        
        // Start streaming
        streamPinterestBoard(boardUrl);
    });

    // Allow pressing Enter to submit
    pinterestUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            generateBtn.click();
        }
    });

    // Helper function to extract pin data from a malformed JSON string
    function extractPinDataFromString(dataString) {
        try {
            // Extract pin image URL
            const imageUrlMatch = dataString.match(/"image_url":\s*"([^"]+)"/);
            const imageUrl = imageUrlMatch ? imageUrlMatch[1] : '';
            
            // Extract pin title
            const titleMatch = dataString.match(/"title":\s*"([^"]+)"/);
            const title = titleMatch ? titleMatch[1] : 'Pinterest Pin';
            
            // Extract pin link
            const linkMatch = dataString.match(/"link":\s*"([^"]+)"/);
            const link = linkMatch ? linkMatch[1] : '#';
            
            // Extract text description if available
            const textMatch = dataString.match(/"text":\s*"([^"]+)"/);
            const text = textMatch ? textMatch[1] : '';
            
            // Try to extract box coordinates if available
            let box = [0, 0, 0, 0]; // Default empty box
            
            // Look for box pattern like: "box":[0.1,0.2,0.8,0.9]
            const boxMatch = dataString.match(/"box":\s*\[([^\]]+)\]/);
            if (boxMatch && boxMatch[1]) {
                // Extract the coordinates and convert to numbers
                const boxCoords = boxMatch[1].split(',').map(coord => parseFloat(coord.trim()));
                if (boxCoords.length === 4 && !boxCoords.some(isNaN)) {
                    box = boxCoords;
                    console.log('Successfully extracted box coordinates:', box);
                }
            }
            
            // Create a pin object with extracted data
            return {
                pin: {
                    image_url: imageUrl,
                    title: title,
                    link: link,
                    id: ''
                },
                text: text,
                box: box,
                similar_items: []
            };
        } catch (error) {
            console.error('Failed to extract pin data from string:', error);
            return null;
        }
    }

    // Function to set up product cards after they're created
    function setupProductCards() {
        // Target all product info containers
        const productInfoElements = document.querySelectorAll('.product-info');
        
        productInfoElements.forEach(info => {
            // Make sure product info is visible
            info.style.overflow = 'visible';
            info.style.height = '70px';
            
            // Make sure the product title can wrap to two lines
            const titleElement = info.querySelector('.product-title');
            if (titleElement) {
                titleElement.style.webkitLineClamp = '2';
                titleElement.style.display = '-webkit-box';
            }
        });
    }

    // Update product info display to ensure consistent text truncation
    function fixProductTextDisplay() {
        const productTitles = document.querySelectorAll('.product-title');
        
        productTitles.forEach(title => {
            // Ensure title is truncated with ellipsis
            title.style.whiteSpace = 'nowrap';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.style.display = 'block'; // Override -webkit-box display
            title.style.webkitLineClamp = '1';
            
            // Manually add ellipsis if text is too long (for browsers that don't support text-overflow)
            if (title.scrollWidth > title.clientWidth) {
                const text = title.textContent;
                const maxLength = Math.floor(title.clientWidth / (title.offsetWidth / text.length) * 0.85);
                if (text.length > maxLength) {
                    title.textContent = text.substring(0, maxLength) + '...';
                }
            }
        });
    }

    // Update staggering to prevent overlapping
    function setupSimilarItems() {
        const similarItems = document.querySelectorAll('.similar-item');
        
        console.log('Setting up similar items');
        console.log('Found', similarItems.length, 'similar items');
        
        // Always add mobile class - use mobile view for all screen sizes
        document.querySelectorAll('.pin-container').forEach(container => {
            container.classList.add('mobile-view');
        });
        
        // Force similar items containers to be visible
        document.querySelectorAll('.similar-items-container').forEach(container => {
            container.style.display = 'block';
            container.style.width = '100%';
            container.style.height = 'auto';
            container.style.minHeight = '250px';
            container.style.overflow = 'visible';
            container.style.margin = '10px 0';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
            
            // Force similar items to be visible
            const itemsRow = container.querySelector('.similar-items');
            if (itemsRow) {
                itemsRow.style.display = 'flex';
                itemsRow.style.overflowX = 'auto';
                itemsRow.style.overflowY = 'visible';
                itemsRow.style.width = '100%';
                itemsRow.style.height = 'auto';
                itemsRow.style.minHeight = '240px';
                itemsRow.style.padding = '10px 0';
                itemsRow.style.visibility = 'visible';
                itemsRow.style.opacity = '1';
            } else {
                console.error('Could not find .similar-items within container');
            }
        });
        
        // If no similar items are found, add fallback items for each section
        const emptyRails = document.querySelectorAll('.similar-items:empty');
        if (emptyRails.length > 0) {
            console.warn(`Found ${emptyRails.length} empty similar items rails, adding fallbacks`);
            
            emptyRails.forEach(rail => {
                // Try to get the heading text from the parent section
                const section = rail.closest('.detected-item-section');
                const heading = section ? section.querySelector('.item-heading')?.textContent || 'Similar style' : 'Similar style';
                
                // Add fallback items to ensure something is visible
                addFallbackItems(rail, heading);
                console.log('Added fallback items to empty rail');
            });
        }
        
        // Clear any previous styles that might interfere
        similarItems.forEach((item, index) => {
            // Reset transforms that might conflict with our CSS
            item.style.transform = '';
            
            // Flat layout for all screens
            item.style.marginTop = '0';
            
            // FORCE ITEM TO BE VISIBLE
            item.style.display = 'block';
            item.style.visibility = 'visible';
            item.style.opacity = '1';
            item.style.position = 'relative';
            item.style.flex = '0 0 150px';
            item.style.width = '150px';
            item.style.height = '220px';
            item.style.margin = '0 8px 0 0';
            
            // Make sure product info is properly displayed with consistent height
            const productInfo = item.querySelector('.product-info');
            if (productInfo) {
                productInfo.style.overflow = 'hidden';
                productInfo.style.height = '70px';
                productInfo.style.display = 'block';
                productInfo.style.visibility = 'visible';
            }
        });
        
        // Fix product text display
        fixProductTextDisplay();
        
        // Use mobile alignment for all viewport sizes
        alignSimilarItemsMobile();
    }

    // Special function for mobile alignment
    function alignSimilarItemsMobile() {
        console.log('Forcing mobile alignment for multiple rails');
        
        // Reset desktop layout
        document.querySelectorAll('.pin-container').forEach(container => {
            container.classList.add('mobile-view');
            
            // Force center alignment on the Pinterest image container
            const imageContainer = container.querySelector('.pin-image-outer-container');
            if (imageContainer) {
                imageContainer.style.margin = '0 auto 15px';
                imageContainer.style.display = 'flex';
                imageContainer.style.flexDirection = 'column';
                imageContainer.style.alignItems = 'center';
                imageContainer.style.width = '100%';
                imageContainer.style.maxWidth = '300px';
            }
            
            // Force center alignment on the Pinterest image
            const pinImageContainer = container.querySelector('.pin-image-container');
            if (pinImageContainer) {
                pinImageContainer.style.display = 'flex';
                pinImageContainer.style.flexDirection = 'column';
                pinImageContainer.style.alignItems = 'center';
                pinImageContainer.style.width = '100%';
            }
            
            // Force center alignment on the Pinterest image itself
            const pinImage = container.querySelector('.pin-image');
            if (pinImage) {
                pinImage.style.maxWidth = '100%';
                pinImage.style.height = 'auto';
                pinImage.style.display = 'block';
                pinImage.style.margin = '0 auto';
            }
        });
        
        // Fix flex containers for mobile
        document.querySelectorAll('.flex-container').forEach(container => {
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.gap = '0';
            container.style.marginBottom = '5px';
            container.style.marginTop = '0';
            container.style.width = '100%';
            container.style.marginLeft = '0';
        });
        
        // Adjust all similar items containers
        document.querySelectorAll('.similar-items-container').forEach(container => {
            container.style.width = '100%';
            container.style.marginLeft = '0';
            container.style.margin = '0 auto';
            container.style.height = 'auto';
            container.style.minHeight = '200px';
            container.style.marginBottom = '0';
            container.style.paddingBottom = '0';
            container.style.paddingTop = '0';
            container.style.marginTop = '0';
            container.style.display = 'block';
            
            const similarItems = container.querySelector('.similar-items');
            if (similarItems) {
                similarItems.style.paddingTop = '4px';
                similarItems.style.paddingBottom = '0';
                similarItems.style.minHeight = '200px';
                similarItems.style.borderTop = 'none';
                similarItems.style.width = '100%';
                similarItems.style.margin = '0 auto';
            }
        });
        
        // Ensure item headings are properly styled for mobile
        document.querySelectorAll('.item-heading').forEach(heading => {
            heading.style.fontSize = '1.1rem';
            heading.style.margin = '0 0 3px';
            heading.style.padding = '8px 5px 5px';
            heading.style.width = '90%';
            heading.style.backgroundColor = 'transparent'; 
            heading.style.position = 'relative';
            heading.style.zIndex = '5';
            heading.style.textAlign = 'center';
            
            const line = heading.querySelector('::after');
            if (line) {
                line.style.width = '40px';
                line.style.height = '1px';
            }
        });
        
        // Adjust detected-item-section containers to keep headings attached to rails
        document.querySelectorAll('.detected-item-section').forEach(section => {
            section.style.marginBottom = '20px';
            section.style.borderTop = 'none';
            section.style.position = 'relative';
            section.style.width = '100%';
            section.style.display = 'flex';
            section.style.flexDirection = 'column';
            section.style.alignItems = 'center';
        });
        
        // Adjust pin container spacing
        document.querySelectorAll('.pin-container').forEach(container => {
            container.style.marginBottom = '30px';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
        });
    }

    // Desktop alignment with center positioning
    function alignSimilarItemsDesktop() {
        const flexContainers = document.querySelectorAll('.flex-container');
        flexContainers.forEach(container => {
            const pinImage = container.querySelector('.pin-image');
            const similarItemsContainer = container.querySelector('.similar-items-container');
            
            if (pinImage && similarItemsContainer) {
                // Wait for images to load to get correct heights
                if (pinImage.complete) {
                    alignSimilarItems(pinImage, similarItemsContainer);
                } else {
                    pinImage.onload = function() {
                        alignSimilarItems(pinImage, similarItemsContainer);
                    };
                }
            }
        });
    }

    // Run setupSimilarItems whenever layout might change
    window.addEventListener('resize', function() {
        // Wait a bit for layout to settle
        setTimeout(function() {
            setupSimilarItems();
        }, 100);
    });

    // Apply centering immediately when images load
    document.addEventListener('load', function(e) {
        if (e.target.tagName === 'IMG') {
            // Wait a bit for layout to settle
            setTimeout(function() {
                setupSimilarItems();
            }, 50);
        }
    }, true);

    // Run this function after the mood board is created
    document.addEventListener('DOMContentLoaded', function() {
        setupSimilarItems();
        
        // Additional call to set up cards when the mood board is created
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    setupSimilarItems();
                    setupProductCards();
                }
            });
        });
        
        // Start observing the mood board for changes
        observer.observe(document.getElementById('mood-board'), { childList: true, subtree: true });
    });

    // Ensure all pin titles are displayed in lowercase
    function updatePinTitles() {
        const pinTitles = document.querySelectorAll('.pin-title');
        
        pinTitles.forEach(title => {
            // Set the title style to ensure lowercase
            title.style.textTransform = 'lowercase';
            
            // Also convert the text content to lowercase for browsers that might not support textTransform
            if (title.textContent) {
                title.textContent = title.textContent.toLowerCase();
            }
        });
    }

    // Add to existing setup functions
    document.addEventListener('DOMContentLoaded', function() {
        // Call immediately on page load
        updatePinTitles();
        
        // Also observe for any new pins being added
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    // Check if added nodes might contain pin titles
                    updatePinTitles();
                }
            });
        });
        
        // Start observing the mood board for changes
        const moodBoard = document.getElementById('mood-board');
        if (moodBoard) {
            observer.observe(moodBoard, { childList: true, subtree: true });
        }
    });

    // Add window resize listener to update layout when screen size changes
    window.addEventListener('resize', function() {
        // Re-align all pins on resize
        const flexContainers = document.querySelectorAll('.flex-container');
        flexContainers.forEach(container => {
            const pinImage = container.querySelector('.pin-image');
            const similarItemsContainer = container.querySelector('.similar-items-container');
            
            if (pinImage && similarItemsContainer) {
                // Update the layout when screen size changes
                alignSimilarItems(pinImage, similarItemsContainer);
            }
        });
        
        // Remove staggered layout on mobile, apply it on desktop
        const isMobile = window.innerWidth <= 768;
        const similarItems = document.querySelectorAll('.similar-item');
        
        similarItems.forEach((item, index) => {
            if (isMobile) {
                // Flatten layout on mobile
                item.style.marginTop = '0';
            } else {
                // Restore staggered layout on desktop
                if (index % 2 === 0) {
                    item.style.marginTop = '-40px';
                } else {
                    item.style.marginTop = '40px';
                }
            }
        });
    });

    // Helper function to create a similar item card
    function createSimilarItemCard(similarItem, idx) {
        const productLink = document.createElement('a');
        productLink.href = similarItem.metadata.link || '#';
        productLink.target = '_blank';
        productLink.className = 'similar-item';
        productLink.title = similarItem.metadata.title || 'Similar product';
        productLink.style.textDecoration = 'none';
        productLink.setAttribute('rel', 'noopener');
        
        // Create product image
        const productImg = document.createElement('img');
        productImg.src = similarItem.metadata.image_url;
        productImg.alt = similarItem.metadata.title || 'Similar product';
        productImg.loading = 'lazy'; // Lazy load images
        productImg.onerror = function() {
            this.src = 'https://via.placeholder.com/150x200/eeeeee/999999?text=Image+Unavailable';
        };
        
        // Create product info
        const productInfo = document.createElement('div');
        productInfo.className = 'product-info';
        productInfo.style.textDecoration = 'none';
        
        // Add product title with link
        const productTitle = document.createElement('div');
        productTitle.className = 'product-title';
        productTitle.textContent = similarItem.metadata.title || 'Product';
        productTitle.style.textDecoration = 'none';
        
        // Add brand if available
        if (similarItem.metadata.brand) {
            const productBrand = document.createElement('div');
            productBrand.className = 'product-brand';
            productBrand.textContent = similarItem.metadata.brand;
            productInfo.appendChild(productBrand);
        }
        
        // Add price
        const price = document.createElement('div');
        price.className = 'price';
        const priceText = similarItem.metadata.discounted_price || similarItem.metadata.price || 'Price not available';
        price.textContent = `₹${priceText}`;
        
        // Make the entire product info area clickable
        productInfo.onclick = function() {
            window.open(similarItem.metadata.link || '#', '_blank');
        };
        
        // Assemble product card
        productInfo.appendChild(productTitle);
        productInfo.appendChild(price);
        
        productLink.appendChild(productImg);
        productLink.appendChild(productInfo);
        return productLink;
    }

    // Function to add fallback items to the similar items rail
    function addFallbackItems(similarItemsContainer, titleText) {
        // Create some placeholder items so the rail isn't empty
        const placeholderCategories = ['Tops', 'Jeans', 'Dresses', 'Skirts', 'Jackets', 'Accessories'];
        const placeholderBrands = ['ZARA', 'H&M', 'MANGO', 'UNIQLO', 'GAP', 'FOREVER 21'];
        const placeholderPrices = ['1,299', '899', '1,599', '2,499', '1,999', '3,499'];
        const placeholderColors = ['#f5f5f5', '#e9e9e9', '#f8f8f8', '#efefef', '#f0f0f0', '#e5e5e5'];
        
        for (let i = 0; i < 5; i++) {
            const itemLink = document.createElement('a');
            itemLink.href = '#';
            itemLink.className = 'similar-item';
            itemLink.title = 'Suggested item';
            
            // Create placeholder image
            const placeholderImg = document.createElement('div');
            placeholderImg.style.width = '100%';
            placeholderImg.style.height = '170px';
            placeholderImg.style.backgroundColor = placeholderColors[i % placeholderColors.length];
            placeholderImg.style.display = 'flex';
            placeholderImg.style.alignItems = 'center';
            placeholderImg.style.justifyContent = 'center';
            
            // Add a message in the placeholder
            const placeholderText = document.createElement('span');
            placeholderText.textContent = placeholderCategories[i % placeholderCategories.length];
            placeholderText.style.color = '#aaa';
            placeholderText.style.fontSize = '14px';
            placeholderImg.appendChild(placeholderText);
            
            // Create product info
            const productInfo = document.createElement('div');
            productInfo.className = 'product-info';
            
            // Add brand
            const productBrand = document.createElement('div');
            productBrand.className = 'product-brand';
            productBrand.textContent = placeholderBrands[i % placeholderBrands.length];
            
            // Add title based on the pin's title
            const productTitle = document.createElement('div');
            productTitle.className = 'product-title';
            productTitle.textContent = `${titleText} - ${placeholderCategories[i % placeholderCategories.length]}`;
            
            // Add price
            const price = document.createElement('div');
            price.className = 'price';
            price.textContent = `₹${placeholderPrices[i % placeholderPrices.length]}`;
            
            // Assemble product card
            productInfo.appendChild(productBrand);
            productInfo.appendChild(productTitle);
            productInfo.appendChild(price);
            
            itemLink.appendChild(placeholderImg);
            itemLink.appendChild(productInfo);
            similarItemsContainer.appendChild(itemLink);
        }
    }

    // Helper function to align similar items rails
    function alignSimilarItems(pinImage, similarItemsContainer) {
        // Check if we're in mobile view (using window width)
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // On mobile, reset any vertical alignment so items appear stacked
            const similarItems = similarItemsContainer.querySelector('.similar-items');
            if (similarItems) {
                similarItems.style.paddingTop = '20px';
                similarItems.style.paddingBottom = '20px';
                similarItems.style.marginTop = '0';
                similarItemsContainer.style.height = 'auto';
                
                // Make sure similar items are visible on mobile
                similarItemsContainer.style.overflow = 'visible';
                similarItems.style.overflow = 'auto';
                
                console.log('Mobile view: showing similar items stacked');
            }
            return;
        }
        
        // Desktop layout with side-by-side rails
        const similarItems = similarItemsContainer.querySelector('.similar-items');
        
        if (similarItems) {
            // Keep staggered layout in desktop side-by-side view
            const staggerHeight = 80; // Total height of stagger (-40px to +40px)
            
            // Apply padding for visual balance
            similarItems.style.paddingTop = '20px';
            similarItems.style.paddingBottom = '20px';
            similarItems.style.marginTop = '0';
            
            // Set the similar items container to be full width in its column
            similarItemsContainer.style.height = 'auto';
            similarItemsContainer.style.width = '100%';
            similarItemsContainer.style.margin = '0 auto';
            
            // Find the pin container to check how many flex containers (rails) it has
            const pinContainer = similarItemsContainer.closest('.pin-container');
            if (pinContainer) {
                const railCount = pinContainer.querySelectorAll('.flex-container').length;
                
                // Find the current flex container
                const currentFlex = similarItemsContainer.closest('.flex-container');
                if (currentFlex) {
                    if (railCount === 1) {
                        // For single rail, center it vertically
                        currentFlex.style.alignSelf = 'center';
                        currentFlex.style.marginTop = '0';
                        currentFlex.style.marginBottom = '0';
                    } else {
                        // For multiple rails, reduce spacing between them
                        currentFlex.style.marginTop = '5px'; // Reduced from 10px
                        currentFlex.style.marginBottom = '5px'; // Reduced from 10px
                    }
                }
            }
            
            console.log('Desktop view: side-by-side layout with staggered items');
        }
    }
}); 
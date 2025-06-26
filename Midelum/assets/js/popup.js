// Import configuration
import config from '../../config.js';

// Sample text templates for demonstration
const sampleTexts = [
    "This is a sample summary of the content. It demonstrates how the text will appear in the container. The summary includes key points and main ideas from the original content.This is a sample summary of the content. It demonstrates how the text will appear in the container. The summary includes key points and main ideas from the original content.This is a sample summary of the content. It demonstrates how the text will appear in the container. The summary includes key points and main ideas from the original content.This is a sample summary of the content. It demonstrates how the text will appear in the container. The summary includes key points and main ideas from the original content.This is a sample summary of the content. It demonstrates how the text will appear in the container. The summary includes key points and main ideas from the original content.This is a sample summary of the content. It demonstrates how the text will appear in the container. The summary includes key points and main ideas from the original content.",
    "Here's another example summary. This shows how longer text will be handled within the container. The text will automatically scroll if it exceeds the maximum height.",
    "A third sample summary to show variety. This demonstrates the styling and formatting of the text container with different content lengths."
];

// Function to get a random sample text
function getRandomSample() {
    const randomIndex = Math.floor(Math.random() * sampleTexts.length);
    return sampleTexts[randomIndex];
}

// Function to get current tab URL
async function getCurrentTabUrl() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab.url;
    } catch (error) {
        console.error('Error getting current tab URL:', error);
        return null;
    }
}

// Function to simulate processing (in a real extension, this would call an API or process the page content)
function processContent() {
    // Simulate some processing time
    return new Promise((resolve) => {
        setTimeout(() => {
            // Example of using config values
            console.log('Using API Key:', config.API_KEY);
            resolve(getRandomSample());
        }, 1000); // 1 second delay to simulate processing
    });
}

// Function to update the summary text
function updateSummaryText(text) {
    const summaryElement = document.querySelector('.summary-text');
    summaryElement.textContent = text;
}

// Function to handle the summarize button click
async function handleSummarizeClick() {
    const button = document.querySelector('.summarize-btn');
    const originalText = button.innerHTML;
    
    // Disable button and show loading state
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        // Get the processed content
        const summary = await processContent();
        // Update the summary text
        updateSummaryText(summary);
    } catch (error) {
        console.error('Error processing content:', error);
        updateSummaryText('An error occurred while processing the content.');
    } finally {
        // Re-enable button and restore original text
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Function to check if we're on the new tab page and update UI accordingly
async function checkNewTabPage() {
    const currentUrl = await getCurrentTabUrl();
    const button = document.querySelector('.summarize-btn');
    const summaryElement = document.querySelector('.summary-text');
    
    if (currentUrl === 'chrome://newtab/') {
        button.disabled = true;
        button.style.opacity = '0.5';
        summaryElement.textContent = 'Go to a site and ask claude to summarize it for you!';
        summaryElement.style.color = 'var(--text-secondary)';
        summaryElement.style.fontStyle = 'italic';
    } else {
        button.disabled = false;
        button.style.opacity = '1';
        summaryElement.textContent = 'Your summary will appear here...';
        summaryElement.style.color = 'var(--text-secondary)';
        summaryElement.style.fontStyle = 'normal';
    }
}

// Add event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const summarizeButton = document.querySelector('.summarize-btn');
    summarizeButton.addEventListener('click', handleSummarizeClick);
    
    // Check if we're on the new tab page when popup opens
    checkNewTabPage();
});

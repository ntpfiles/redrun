const { ipcRenderer } = require('electron');
const axios = require('axios');
const OpenAI = require('openai');

let openai = null;

async function initializeOpenAI(apiKey) {
    if (apiKey) {
        openai = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
        });
    }
}

// Load saved API key on startup
ipcRenderer.invoke('get-api-key').then(apiKey => {
    if (apiKey) {
        document.getElementById('apiKey').value = apiKey;
        initializeOpenAI(apiKey);
    }
});

async function fetchRedditComments(username) {
    try {
        const response = await axios.get(`https://www.reddit.com/user/${username}/comments.json`);
        const comments = response.data.data.children.map(child => child.data.body).filter(comment => comment);
        return comments.slice(0, 20); // Limit to 20 most recent comments
    } catch (error) {
        throw new Error('Failed to fetch Reddit comments. Please check the username and try again.');
    }
}

async function analyzeComments(comments, prompt) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'user',
                content: prompt + "\n\nHere are the user's recent comments:\n" + comments.join('\n') + "\n\nAnalysis:"
            }],
            max_tokens: 1000,
            temperature: 0.7,
            presence_penalty: 0.2,
            frequency_penalty: 0.2
        });

        return response.choices[0].message.content;
    } catch (error) {
        throw new Error('Failed to analyze comments: ' + error.message);
    }
}

async function analyzeUser() {
    const resultDiv = document.getElementById('result');
    const username = document.getElementById('username').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const prompt = document.getElementById('prompt').value.trim();

    if (!username || !apiKey) {
        resultDiv.innerHTML = '<span class="error">Please provide both username and API key.</span>';
        return;
    }

    try {
        await ipcRenderer.invoke('save-api-key', apiKey);
        await initializeOpenAI(apiKey);

        resultDiv.textContent = 'Fetching recent comments...';
        const comments = await fetchRedditComments(username);
        
        resultDiv.textContent = 'Analyzing comments...';
        const analysis = await analyzeComments(comments, prompt);
        
        resultDiv.textContent = analysis;
    } catch (error) {
        resultDiv.innerHTML = `<span class="error">${error.message}</span>`;
    }
}

function copyResult() {
    const result = document.getElementById('result').textContent;
    navigator.clipboard.writeText(result)
        .then(() => {
            const originalText = document.getElementById('result').textContent;
            document.getElementById('result').textContent = 'Copied to clipboard!';
            setTimeout(() => {
                document.getElementById('result').textContent = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
        });
}
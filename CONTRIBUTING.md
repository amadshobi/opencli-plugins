# 🤝 Contributing to OpenCLI Plugins

Thank you for considering contributing to the OpenCLI Plugins collection! 

---

## 🚀 Development Workflow

### 1. Prerequisites
- **Node.js** (v20+ recommended)
- **OpenCLI** installed globally:
  ```bash
  npm install -g @jackwener/opencli
  ```
- **OpenCLI Browser Extension** loaded in your Chromium browser and connected to the daemon (`opencli doctor`).

### 2. Fork & Clone
```bash
git clone https://github.com/<your-username>/opencli-plugins.git
cd opencli-plugins
```

### 3. Local Plugin Testing
You can install and test your modified local plugin directly in OpenCLI without publishing to npm:

```bash
# Link local plugin folder
opencli plugin install ./opencli-plugin-aistudio

# Test your command live
opencli aistudio status
```

---

## 🛡️ Coding & Security Guidelines

1. **Input Sanitization (Crucial)**:
   - When passing strings or variables into `page.evaluate()`, **ALWAYS** escape them with `${JSON.stringify(variable)}` to prevent code injection or breaking on quotes/special characters.
   - Example:
     ```javascript
     // ✅ Good & Safe
     await page.evaluate(`ta.value = ${JSON.stringify(userText)};`);

     // ❌ Dangerous (vulnerable to quotes and special chars)
     await page.evaluate(`ta.value = "${userText}";`);
     ```

2. **Zero Hardcoded Secrets**:
   - Never commit API keys, personal phone numbers, session cookies, or local absolute machine paths (`C:\Users\...`).
   - Use relative paths (`./`) in all scripts and documentation.

3. **DOM Selector Resilience**:
   - Web application frontends update frequently. Always provide fallback selectors:
     ```javascript
     const elem = document.querySelector('[aria-label="Target"]') ||
                  document.querySelector('.primary-class') ||
                  document.querySelector('button');
     ```

---

## 🔀 Submitting a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feature/awesome-new-command
   ```
2. Commit your changes with conventional commit messages:
   ```bash
   git commit -m "feat(aistudio): add new video editing parameter"
   ```
3. Push to your branch and open a Pull Request using the provided PR template.

Happy coding! 🎉

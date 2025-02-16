<p align="center">
  <img src="./images/tasknet-color@2x.png" alt="TaskNet Logo" width="300"/>
</p>

<h1 align="center">Browser Scraper Service</h1>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)

A Node.js service for controlling browser instances using Puppeteer, providing a REST API for browser automation and scraping tasks.

## 🚀 Features

- 🎯 Precise browser control through coordinates
- 🔄 Multiple browser actions (click, hover, type, etc.)
- 📸 Screenshot capabilities
- 📜 Page navigation and management
- 🖱️ Advanced mouse interactions
- ⌨️ Keyboard input simulation
- 📑 Multi-page handling
- 🔍 DOM element selection and interaction

## 🛠️ API Reference

### Core Endpoints

#### Page Routes
- `POST /page/goToPage` - Navigate to a URL
- `POST /page/executeCommands` - Execute browser commands
- `POST /page/getWindowInfo` - Get browser window information
- `POST /page/newPage` - Create a new page
- `POST /page/closePage` - Close a page
- `POST /page/pdf` - Generate PDF
- And more...

#### Session Routes
- `POST /session/createSession` - Create a new browser session
- `DELETE /session/:sessionID/invalidateSession` - End a session
- `GET /session/:sessionID/info` - Get session information
- And more...

### Execute Commands API

The most powerful endpoint is `/page/executeCommands` which allows executing multiple browser actions in sequence.

#### Request Format
```typescript
POST /page/executeCommands
{
    "commands": Command[]
}
```

#### Available Commands

| Command Type | Description | Parameters |
|-------------|-------------|------------|
| Click | Click at coordinates | `{ action: "Click", x: number, y: number, clickCount: number, button: "left"\|"right"\|"middle" }` |
| Hover | Hover at coordinates | `{ action: "Hover", x: number, y: number }` |
| TypeInput | Type text at coordinates | `{ action: "TypeInput", x: number, y: number, input: string }` |
| Select | Select dropdown option | `{ action: "Select", x: number, y: number, value: string }` |
| Delay | Wait for specified time | `{ action: "Delay", delay: number }` |
| ScreenShot | Capture area screenshot | `{ action: "ScreenShot", x: number, y: number, width: number, height: number }` |
| ScrollTo | Scroll to position | `{ action: "ScrollTo", x: number, y: number }` |
| KeyPress | Simulate keyboard press | `{ action: "KeyPress", key: KeyInput }` |

#### Example Usage

```typescript
// Click a button and type text
{
    "commands": [
        {
            "action": "Click",
            "x": 100,
            "y": 200,
            "clickCount": 1,
            "button": "left"
        },
        {
            "action": "TypeInput",
            "x": 150,
            "y": 250,
            "input": "Hello World"
        }
    ]
}
```

## 🔧 Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- Browser Container Manager service running
- Sufficient system resources for browser operations

## 🚀 Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the service:
```bash
npm start
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [TaskNet Node Software](https://github.com/Ajent-foundation/tasknet-node)
# Terragrunt MCP Server

A Model Context Protocol (MCP) server that provides comprehensive Terragrunt documentation and tooling integration for VS Code with GitHub Copilot.

## Features

### 📚 Documentation Access

- **Live Documentation**: Automatically fetches the latest Terragrunt documentation from the official website
- **Searchable Content**: Full-text search across all Terragrunt documentation
- **Organized by Sections**: Browse documentation by categories (getting-started, reference, features, etc.)
- **Cached for Performance**: Smart caching system with 24-hour refresh cycle

### 🔧 Available Tools

1. **`search_terragrunt_docs`** - Search Terragrunt documentation for specific topics
   - Parameters: `query` (string), `limit` (number, optional)
   - Example: Search for "dependencies", "remote state", "generate block"

2. **`get_terragrunt_sections`** - List all available documentation sections
   - No parameters required
   - Returns all sections with document counts

3. **`get_section_docs`** - Get all documentation for a specific section
   - Parameters: `section` (string)
   - Example sections: "getting-started", "reference", "features"

4. **`get_cli_command_help`** - Get detailed help for a specific Terragrunt CLI command
   - Parameters: `command` (string)
   - Example: "plan", "apply", "run-all", "hclfmt"
   - Searches reference/cli documentation for command details

5. **`get_hcl_config_reference`** - Get documentation for HCL configuration elements
   - Parameters: `config` (string)
   - Example: "terraform", "remote_state", "dependency", "inputs"
   - Finds HCL blocks, attributes, and functions documentation

6. **`get_code_examples`** - Find code examples and snippets for specific topics
   - Parameters: `topic` (string), `limit` (number, optional)
   - Example: "remote state", "dependencies", "before hooks"
   - Extracts code snippets with context from documentation

### 📖 Resources

- Complete documentation overview with section breakdown
- Individual documentation pages as separate resources
- Section-based documentation collections
- All content accessible through VS Code and Copilot

## Installation

1. **Clone and build the server:**

```bash
git clone <your-repo>
cd terragrunt-mcp-server
npm install
npm run build
```

2. **Configure VS Code to use the MCP server:**

Add the following to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "node",
      "args": ["/path/to/terragrunt-mcp-server/dist/index.js"]
    }
  }
}
```

Or if you want to run in development mode:

```json
{
  "mcp.servers": {
    "terragrunt": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/path/to/terragrunt-mcp-server"
    }
  }
}
```

## Usage with GitHub Copilot

Once configured, you can interact with Terragrunt documentation directly through Copilot:

### Example Prompts

#### General Documentation Search
- *"Search for Terragrunt documentation about dependencies"*
- *"Show me the getting started guide for Terragrunt"*
- *"What are the available configuration options in Terragrunt?"*
- *"How do I use remote state with Terragrunt?"*
- *"Find documentation about Terragrunt generate blocks"*

#### CLI Command Help
- *"What options are available for the terragrunt plan command?"*
- *"How do I use terragrunt run-all?"*
- *"Show me help for the hclfmt command"*
- *"What does terragrunt validate-inputs do?"*

#### HCL Configuration Reference
- *"Show me how to configure the terraform block in terragrunt.hcl"*
- *"What are the available remote_state options?"*
- *"How do I use the dependency block?"*
- *"What attributes can I use in the inputs block?"*

#### Code Examples
- *"Show me examples of using dependencies in Terragrunt"*
- *"Find code snippets for remote state configuration"*
- *"What are some examples of before_hook usage?"*
- *"Show me how to use generate blocks with examples"*

### Advanced Usage

- *"Compare different approaches for Terragrunt module organization"*
- *"Show me best practices for Terragrunt project structure"*
- *"What's new in the latest Terragrunt documentation?"*

## Project Structure

```
terragrunt-mcp-server
├── src
│   ├── index.ts          # Entry point for the application
│   ├── server.ts         # Main server logic
│   ├── handlers          # Contains various request handlers
│   │   ├── tools.ts      # Tool management functions
│   │   ├── resources.ts   # Resource management functions
│   │   └── prompts.ts    # User interaction functions
│   ├── terragrunt        # Terragrunt-related functionalities
│   │   ├── commands.ts   # Wrapper for Terragrunt commands
│   │   ├── config.ts     # Configuration loading and validation
│   │   └── utils.ts      # Utility functions for Terragrunt
│   └── types             # Type definitions
│       ├── mcp.ts        # MCP protocol types
│       └── terragrunt.ts  # Terragrunt types
├── schemas
│   └── mcp-protocol.json  # JSON schema for MCP protocol
├── package.json           # npm configuration file
├── tsconfig.json          # TypeScript configuration file
├── .gitignore             # Git ignore file
└── README.md              # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (version X.X.X or higher)
- npm (version X.X.X or higher)
- TypeScript (version X.X.X or higher)

### Installation

1. Clone the repository:

   ```
   git clone <repository-url>
   cd terragrunt-mcp-server
   ```

2. Install dependencies:

   ```
   npm install
   ```

### Running the Server

To start the server, run:

```
npm start
```

### Usage

- The server exposes various endpoints for managing tools and resources.
- Use the provided handlers to interact with the MCP protocol and Terragrunt commands.

### Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

### License

This project is licensed under the MIT License. See the LICENSE file for details.

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path"; // Use `import` for consistency
import { createPrivateKey } from "crypto";
import chalk from "chalk";

dotenv.config();

export const env = {
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  // Read private key content from the specified file path
  GITHUB_PRIVATE_KEY: process.env.PRIVATE_KEY_PATH
    ? fs.readFileSync(path.resolve(process.env.PRIVATE_KEY_PATH), "utf8")
    : undefined,
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
} as const;

// Validate environment variables
let valid = true;

if (!env.GITHUB_APP_ID) {
  console.error(
    chalk.red("✖ Missing environment variable: ") + chalk.bold("GITHUB_APP_ID")
  );
  valid = false;
}

if (!env.GITHUB_PRIVATE_KEY) {
  console.error(
    chalk.red("✖ Missing or invalid PRIVATE_KEY_PATH environment variable.")
  );
  valid = false;
} else {
  try {
    // Validate the private key format
    createPrivateKey(env.GITHUB_PRIVATE_KEY);
  } catch (error) {
    console.error(
      chalk.red(
        "\n✖ Invalid GitHub private key format in the file specified by PRIVATE_KEY_PATH."
      ) +
        chalk.gray("  • Must start with: ") +
        chalk.bold("-----BEGIN RSA PRIVATE KEY-----\n") +
        chalk.gray("  • Must end with:   ") +
        chalk.bold("-----END RSA PRIVATE KEY-----\n")
    );
    valid = false;
  }
}

if (!env.GITHUB_WEBHOOK_SECRET) {
  console.error(
    chalk.red("✖ Missing environment variable: ") +
      chalk.bold("GITHUB_WEBHOOK_SECRET")
  );
  valid = false;
}

if (!env.GROQ_API_KEY) {
  console.error(
    chalk.red("✖ Missing environment variable: ") + chalk.bold("GROQ_API_KEY")
  );
  valid = false;
}

if (!valid) {
  console.error(
    chalk.yellow(
      "\n⚠ Please check your .env file and ensure all variables are set correctly.\n"
    )
  );
  process.exit(1);
}

console.log(
  chalk.green("✔ All required environment variables are loaded successfully!")
);

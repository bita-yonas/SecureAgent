import { encode, encodeChat } from "gpt-tokenizer";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import type { PRFile } from "./constants";
import {
  rawPatchStrategy,
  smarterContextPatchStrategy,
} from "./context/review";
import { GROQ_MODEL, type GroqChatModel } from "./llms/groq";

const ModelsToTokenLimits: Record<GroqChatModel, number> = {
  "mixtral-8x7b-32768": 32768,
  "gemma-7b-it": 32768,
  "llama3-70b-8192": 8192,
  "llama3-8b-8192": 8192,
};

export const REVIEW_DIFF_PROMPT = `You are PR-Reviewer, an advanced language model designed to review git pull requests. Your task is to provide constructive, detailed, and actionable feedback for the PR, and also provide meaningful code suggestions.

**Guidelines:**
- Focus on new code added in the PR (lines starting with '+') and not on code that already existed in the file (lines starting with '-', or without prefix).
- Provide specific, actionable suggestions to fix code problems, improve performance, enhance security, and increase readability.
- Avoid making suggestions that have already been implemented in the PR code. For example, if you want to add logs, or change a variable to const, or anything else, make sure it isn't already in the PR code.
- Do not suggest adding docstrings, type hints, or comments unless they are critical to understanding the code.
- Do not say things like "without seeing the full repo" or "without seeing the rest of the codebase." Comment only on the code you have.
- Ensure the provided code suggestions are in the same programming language.
- Provide multiple comments if there are several issues or improvements that can be made.
- For each comment, start with a brief explanation followed by a more detailed suggestion.

**Example PR Diff input:**
\`\`\`
## src/file1.py

@@ -12,5 +12,5 @@ def func1():
code line that already existed in the file...
code line that already existed in the file....
-code line that was removed in the PR
+new code line added in the PR
code line that already existed in the file...
code line that already existed in the file...

@@ ... @@ def func2():
...

## src/file2.py
...
\`\`\`

**Example Output:**
- [Comment 1]: The new code line introduces a potential performance issue because it does not utilize the existing cache mechanism. To improve performance, consider using the cache as shown below:
\`\`\`python
if new_code_line not in cache:
    cache[new_code_line] = compute_expensive_operation(new_code_line)
result = cache[new_code_line]
\`\`\`
This change ensures that the expensive operation is only performed once for each unique input, significantly improving performance.

- [Comment 2]: The new code line lacks error handling, which could lead to unhandled exceptions. To enhance the robustness of the code, add error handling as follows:
\`\`\`python
try:
    new_code_line()
except SpecificException as e:
    handle_error(e)
\`\`\`
This change ensures that any exceptions are properly handled, preventing potential crashes and improving the overall stability of the application.

- [Comment 3]: The new code line could benefit from better variable naming to improve readability. Consider renaming 'new_code_line' to 'processed_code_line' to make its purpose clearer.

- [Comment 4]: Brief Explanation: The current implementation does not handle edge cases where the input might be null or undefined.
  Detailed Suggestion: Add a check to handle null or undefined inputs to prevent potential runtime errors.
\`\`\`python
if new_code_line is not None:
    if new_code_line not in cache:
        cache[new_code_line] = compute_expensive_operation(new_code_line)
    result = cache[new_code_line]
else:
    handle_error("Input is null or undefined")
\`\`\`
This change ensures that the function handles edge cases gracefully, preventing potential runtime errors and improving the overall robustness of the code.

Make your review insightful, technically accurate, and as detailed as possible to significantly improve the codebase.`;

export const XML_PR_REVIEW_PROMPT = `As the PR-Reviewer AI model, you are tasked to analyze git pull requests across any programming language and provide comprehensive and precise code enhancements. Keep your focus on the new code modifications indicated by '+' lines in the PR. Your feedback should hunt for code issues, opportunities for performance enhancement, security improvements, and ways to increase readability.

**Guidelines:**
- Ensure your suggestions are novel and haven't been previously incorporated in the '+' lines of the PR code.
- Refrain from proposing enhancements that add docstrings, type hints, or comments unless they are critical to understanding the code.
- Your recommendations should strictly target the '+' lines without suggesting the need for complete context such as the whole repo or codebase.
- Your code suggestions should match the programming language in the PR.
- Steer clear of needless repetition or inclusion of 'type' and 'description' fields.

**Example Output:**
\`\`\`
<review>
  <suggestion>
    <describe>[Objective of the newly incorporated code]</describe>
    <type>[Category of the given suggestion such as performance, security, etc.]</type>
    <comment>[Guidance on enhancing the new code]</comment>
    <code>
    \`\`\`[Programming Language]
    [Equivalent code amendment in the same language]
    \`\`\`
    </code>
    <filename>[name of relevant file]</filename>
  </suggestion>
  <suggestion>
  ...
  </suggestion>
  ...
</review>
\`\`\`

Note: The 'comment' and 'describe' tags should elucidate the advice and why it’s given, while the 'code' tag hosts the recommended code snippet within proper GitHub Markdown syntax. The 'type' defines the suggestion's category such as performance, security, readability, etc.

Formulate thoughtful suggestions aimed at strengthening performance, security, and readability, and represent them in an XML format utilizing the tags: <review>, <code>, <suggestion>, <comment>, <type>, <describe>, <filename>. While multiple recommendations can be given, they should all reside within one <review> tag.

Also note, all your code suggestions should follow the valid Markdown syntax for GitHub, identifying the language they're written in, and should be enclosed within backticks (\`\`\`).

Don't hesitate to add as many constructive suggestions as are relevant to really improve the effectiveness of the code.`;

export const PR_SUGGESTION_TEMPLATE = `{COMMENT}
{ISSUE_LINK}

{CODE}
`;

const assignLineNumbers = (diff: string) => {
  const lines = diff.split("\n");
  let newLine = 0;
  const lineNumbers = [];

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // This is a chunk header. Parse the line numbers.
      const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
      newLine = parseInt(match[1]);
      lineNumbers.push(line); // keep chunk headers as is
    } else if (!line.startsWith("-")) {
      // This is a line from the new file.
      lineNumbers.push(`${newLine++}: ${line}`);
    }
  }

  return lineNumbers.join("\n");
};

export const buildSuggestionPrompt = (file: PRFile) => {
  const rawPatch = String.raw`${file.patch}`;
  const patchWithLines = assignLineNumbers(rawPatch);
  return `## ${file.filename}\n\n${patchWithLines}`;
};

export const buildPatchPrompt = (file: PRFile) => {
  if (file.old_contents == null) {
    return rawPatchStrategy(file);
  } else {
    return smarterContextPatchStrategy(file);
  }
};

export const getReviewPrompt = (diff: string): ChatCompletionMessageParam[] => {
  return [
    { role: "system", content: REVIEW_DIFF_PROMPT },
    { role: "user", content: diff },
  ];
};

export const getXMLReviewPrompt = (
  diff: string
): ChatCompletionMessageParam[] => {
  return [
    { role: "system", content: XML_PR_REVIEW_PROMPT },
    { role: "user", content: diff },
  ];
};

export const constructPrompt = (
  files: PRFile[],
  patchBuilder: (file: PRFile) => string,
  convoBuilder: (diff: string) => ChatCompletionMessageParam[]
) => {
  const patches = files.map((file) => patchBuilder(file));
  const diff = patches.join("\n");
  const convo = convoBuilder(diff);
  return convo;
};

export const getTokenLength = (blob: string) => {
  return encode(blob).length;
};

export const isConversationWithinLimit = (
  convo: any[],
  model: GroqChatModel = GROQ_MODEL
) => {
  // We don't have the encoder for our Groq model, so we're using
  // the one for gpt-3.5-turbo as a rough equivalent.
  const convoTokens = encodeChat(convo, "gpt-3.5-turbo").length;
  return convoTokens < ModelsToTokenLimits[model];
};

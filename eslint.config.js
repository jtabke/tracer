import hooks from "eslint-plugin-react-hooks";
import parser from "@typescript-eslint/parser";
export default [
  {
    files: ["ui/**/*.{ts,tsx,jsx,mjs}"],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": hooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" },
  },
];

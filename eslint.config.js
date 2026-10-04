import tseslint from "typescript-eslint"
import hooks from "eslint-plugin-react-hooks"
export default tseslint.config(
    {
        ignores: [
            "dist/**",
            "pkg/**",
            "target/**",
            "node_modules/**",
            "**/*.tsbuildinfo",
        ],
    },
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        plugins: { "react-hooks": hooks },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            "react-hooks/rules-of-hooks": "error",
        },
    },
)

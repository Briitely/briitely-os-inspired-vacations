import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["**/.next/**", "**/node_modules/**", "**/dist/**", "**/build/**"],
  },
];

export default eslintConfig;

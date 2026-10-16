declare module "*.md?raw" {
  const markdown: string;
  export default markdown;
}
declare module "*.md?url" {
  const url: string;
  export default url;
}
declare module "*.png?url" {
  const url: string;
  export default url;
}

declare module "*.jpg?url" {
  const url: string;
  export default url;
}

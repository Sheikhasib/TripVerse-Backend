import fs from "fs";
import path from "path";
import ejs from "ejs";

// Renders an EJS email template by name, mirroring the reference backend
// (`src/app/templates/*.ejs`). The template directory is resolved at runtime
// with fallbacks so it works in every host:
//   - dev (`tsx watch`) and local `dist` run with cwd = project root → src/app/templates
//   - the Vercel bundle (api/index.js) has the templates copied to api/templates → <cwd>/templates
export const renderTemplate = (name: string, data: object): Promise<string> => {
  const candidates = [
    path.join(process.cwd(), "src/app/templates"),
    path.join(process.cwd(), "templates"),
    path.join(process.cwd(), "api/templates"),
  ];

  const dir = candidates.find((d) => fs.existsSync(path.join(d, `${name}.ejs`)));
  if (!dir) {
    throw new Error(`Email template "${name}.ejs" not found`);
  }

  return ejs.renderFile(path.join(dir, `${name}.ejs`), data);
};
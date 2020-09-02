import TJS from "typescript-json-schema";
import * as fs from "fs";
import * as path from 'path'
(async () => {
    const folder = path.join(process.cwd(), './lib/schema')
    const files = fs.readdirSync(folder).filter(file => file.endsWith('.ts') && !file.includes('schema'));
    for (const file of files) {

        const basename = path.basename(file, '.ts')
        const program = TJS.getProgramFromFiles(
            [path.join(folder, file)],
            folder,
        );
        const schema = TJS.generateSchema(program, "Schema");
        fs.writeFileSync(path.join(folder, `${basename}-schema.ts`), `export const Schema = ${JSON.stringify(schema, null, 2)}`)
    }
})().catch(console.error)

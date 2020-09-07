import * as path from 'https://deno.land/std@0.67.0/path/mod.ts'

async function collectFiles(folder: string, parent: string): Promise<string[]> {
  const entries = Deno.readDir(folder)
  const files: string[] = []
  for await (const file of entries) {
    if (file.isDirectory) {
      files.push(...await collectFiles(path.join(folder, file.name), path.join(parent, file.name)))
    } else if (file.isFile) {
      files.push(path.join(parent, file.name))
    }
  }

  return files
}

async function buildFileContent(folder: string, files: string[]) {
  console.log(files)
  const map: Record<string, Uint8Array> = {}
  for (const file of files) {
    map[file] = await Deno.readFile(path.join(folder, file))
  }

  return map
}

async function getFileContent(map: Record<string, Uint8Array>) {
  return new TextEncoder().encode(`
export const Templates: Record<string, Uint8Array> = {
  ${Object.entries(map).map(([file, content]) => `"${file}": new Uint8Array([${content.join(',')}])`).join(',\n')}
};
`)
}

await Deno.writeFile('./lib/services/traefik/template.ts', await getFileContent(await buildFileContent('./lib/services/traefik/templates', await collectFiles('./lib/services/traefik/templates', '.'))))

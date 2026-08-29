// validate-mod.js
//
// Valida um mod Sandkit (Sandustry) ANTES de instalar, usando o proprio
// codigo de validacao/aplicacao de patches do jogo (workshop-mods.js,
// extraido do app.asar). Isso garante que o resultado e identico ao que o
// jogo faria de verdade na inicializacao.
//
// Uso:
//   node validate-mod.js <pasta-do-mod> [caminho-de-instalacao-do-jogo]
//
// Exemplo:
//   node validate-mod.js "c:\Users\Ajax\Desktop\mods\toggle-grab" "D:\SteamLibrary\steamapps\common\Sandustry"
//
// O segundo argumento e opcional; se omitido, tenta os caminhos padrao do
// Steam. A pasta do mod precisa conter modinfo.json (e opcionalmente
// patches.json / main.js / worker.js).

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const DEFAULT_GAME_PATHS = [
	"C:\\Program Files (x86)\\Steam\\steamapps\\common\\Sandustry",
	"D:\\SteamLibrary\\steamapps\\common\\Sandustry",
	"E:\\SteamLibrary\\steamapps\\common\\Sandustry",
];

function fail(message) {
	console.error(`\n[FALHOU] ${message}`);
	process.exit(1);
}

function findGamePath(argPath) {
	const candidates = argPath ? [argPath, ...DEFAULT_GAME_PATHS] : DEFAULT_GAME_PATHS;
	for (const candidate of candidates) {
		const asar = path.join(candidate, "resources", "app.asar");
		if (fs.existsSync(asar)) return { gamePath: candidate, asarPath: asar };
	}
	fail(
		`Nao encontrei a instalacao do Sandustry. Passe o caminho como segundo argumento.\nTentei: ${candidates.join(", ")}`,
	);
}

function extractGameFiles(asarPath) {
	const tmpDir = path.join(os.tmpdir(), "sandustry-mod-validate-extract");
	console.log(`Extraindo app.asar para ${tmpDir} (pode levar alguns segundos)...`);
	fs.rmSync(tmpDir, { recursive: true, force: true });
	execFileSync("npx", ["--yes", "asar", "extract", asarPath, tmpDir], {
		stdio: "inherit",
		shell: true,
		windowsVerbatimArguments: false,
	});
	return tmpDir;
}

function main() {
	const [, , modFolderArg, gamePathArg] = process.argv;
	if (!modFolderArg) {
		fail("Uso: node validate-mod.js <pasta-do-mod> [caminho-de-instalacao-do-jogo]");
	}
	const modFolder = path.resolve(modFolderArg);
	if (!fs.existsSync(path.join(modFolder, "modinfo.json"))) {
		fail(`Nao encontrei modinfo.json em: ${modFolder}`);
	}

	const { asarPath } = findGamePath(gamePathArg);
	const tmpDir = extractGameFiles(asarPath);

	const workshopModsPath = path.join(tmpDir, "workshop-mods.js");
	if (!fs.existsSync(workshopModsPath)) {
		fail(`workshop-mods.js nao encontrado em ${workshopModsPath} - o jogo pode ter mudado de estrutura.`);
	}
	const wm = require(workshopModsPath);

	// 1) Descoberta + validacao de manifesto, exatamente como o jogo faz no boot.
	console.log("\n=== 1) Validando modinfo.json (discoverSandkitWorkshopMods) ===");
	const localRoot = path.dirname(modFolder);
	const discovery = wm.discoverSandkitWorkshopMods({
		workshop: null,
		workshopRoot: null,
		localRoot,
		gameVersion: undefined,
	});
	if (discovery.diagnostics.length > 0) {
		console.log(JSON.stringify(discovery.diagnostics, null, 2));
	}
	const modId = JSON.parse(fs.readFileSync(path.join(modFolder, "modinfo.json"), "utf8")).id;
	const found = discovery.mods.find((m) => m.manifest?.id === modId);
	if (!found) {
		fail(`O mod "${modId}" nao passou na validacao. Veja os diagnosticos acima.`);
	}
	console.log(`OK - manifesto valido: ${JSON.stringify(found.manifest, null, 2)}`);

	// 2) Se houver patches.json, aplica de verdade contra os arquivos reais do jogo.
	const patchesFileName = found.manifest.patches || "patches.json";
	const patchesPath = path.join(modFolder, patchesFileName);
	if (fs.existsSync(patchesPath)) {
		console.log(`\n=== 2) Validando e aplicando ${patchesFileName} ===`);
		const patchesRaw = JSON.parse(fs.readFileSync(patchesPath, "utf8"));
		const validated = wm.validatePatches(patchesRaw);
		if (!validated.ok) {
			fail(`patches.json invalido:\n${JSON.stringify(validated.errors, null, 2)}`);
		}

		const targetFiles = [...new Set(validated.patches.map((p) => p.file))];
		const sources = new Map();
		for (const file of targetFiles) {
			// "js/bundle.js" no patches.json corresponde a dist/js/bundle.js dentro do jogo.
			const realPath = path.join(tmpDir, "dist", ...file.split("/"));
			if (!fs.existsSync(realPath)) {
				fail(`Arquivo alvo do patch nao existe no jogo: ${file} (esperado em ${realPath})`);
			}
			sources.set(file, fs.readFileSync(realPath, "utf8"));
		}

		const result = wm.applyPatchSet(sources, validated.patches);
		let anyFailed = false;
		for (const r of result.results) {
			const label = r.patch.id ? `${r.patch.id} (${r.patch.file})` : r.patch.file;
			if (r.applied) {
				console.log(`  OK   ${label} - ${r.actualMatches} match(es)`);
			} else {
				anyFailed = true;
				console.log(`  FAIL ${label} - motivo: ${r.reason} (esperava ${r.patch.expectedMatches}, achou ${r.actualMatches})`);
			}
		}
		if (anyFailed) {
			fail("Um ou mais patches nao foram aplicados. Veja o motivo acima (provavelmente o jogo atualizou e o texto mudou).");
		}

		// 3) Confere que o resultado ainda e JavaScript sintaticamente valido.
		console.log("\n=== 3) Checando sintaxe do arquivo remendado ===");
		for (const file of targetFiles) {
			const patchedContent = result.sources.get(file);
			try {
				new vm.Script(patchedContent, { filename: file });
				console.log(`  OK   ${file} - sintaxe valida`);
			} catch (error) {
				fail(`Sintaxe invalida em ${file} depois do patch: ${error.message}`);
			}
		}
	} else {
		console.log(`\n(nenhum ${patchesFileName} encontrado - pulando validacao de patches)`);
	}

	console.log("\n=== TUDO OK - o mod deve carregar corretamente no jogo ===");
}

main();

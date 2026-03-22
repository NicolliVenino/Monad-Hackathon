// Configuração da rede Monad
const MONAD_CHAIN_ID = "0x279F";// 10143 decimal
const MONAD_NETWORK = {
    chainId: "0x278F",
    chainName: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: ["https://testnet-rpc.monad.xyz"],
    blockExplorerUrls: ["https://testnet.monadexplorer.com"]
};

async function garantirRedeMonad() {
    const chainAtual = await window.ethereum.request({ method: "eth_chainId" });
    if (chainAtual === MONAD_CHAIN_ID) return; // já está na rede certa

    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: MONAD_CHAIN_ID }]
        });
    } catch (err) {
        // Código 4902 = rede não cadastrada na MetaMask ainda
        if (err.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [MONAD_NETWORK]
            });
        } else {
            throw err;
        }
    }
}

const CONTRACT_ADDRESS = "0x3e33cF43dFb58a34cB8c95B0fdf20814D4f8a82B";

const CONTRACT_ABI = [
	"function registrarHospital(string nome, string localizacao, address wallet, uint256 vagasGeral, uint256 vagasPediatria, uint256 vagasOrtopedia, uint256 vagasCardio) external returns (uint256 idGerado)",
	"function totalHospitais() external view returns (uint256)",
	"event HospitalRegistrado(uint256 indexed id, address indexed wallet, string nome, string localizacao, uint256 geral, uint256 pediatria, uint256 ortopedia, uint256 cardio, uint256 criadoEm)"
];

// --- UI helpers ---

function setStatus(mensagem, tipo) {
	const el = document.getElementById("statusCadastro");
	el.innerText = mensagem;
	el.style.color = tipo === "erro" ? "#c62828" : tipo === "ok" ? "#2e7d32" : "#22505a";
}

function setBlockchainStatus(estado, texto) {
	const dot = document.getElementById("statusDot");
	const span = document.getElementById("statusText");
	dot.className = `status-dot ${estado}`;
	span.textContent = texto;
}

// --- Verificação de conexão ao carregar ---

function aguardarEthereum(tentativas = 30) {
	return new Promise((resolve) => {
		if (typeof window.ethereum !== "undefined") return resolve(true);
		let t = 0;
		const iv = setInterval(() => {
			t++;
			if (typeof window.ethereum !== "undefined") { clearInterval(iv); resolve(true); }
			else if (t >= tentativas) { clearInterval(iv); resolve(false); }
		}, 100);
	});
}

async function verificarConexao() {
	try {
		const encontrou = await aguardarEthereum();
		if (!encontrou) throw new Error("MetaMask não encontrada");
		await garantirRedeMonad();
		const provider = new ethers.BrowserProvider(window.ethereum);
		const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
		const total = await contract.totalHospitais();
		setBlockchainStatus("connected", `Blockchain conectada · ${Number(total)} hospital(is) registrado(s)`);
	} catch (err) {
		if (!window.ethereum) {
			setBlockchainStatus("error", "MetaMask não encontrada. Instale a extensão para continuar.");
			document.getElementById("btnCadastrar").disabled = true;
		} else {
			setBlockchainStatus("error", "MetaMask encontrada, mas erro na rede. Verifique a rede correta.");
		}
	}
}

// --- Leitura e validação dos campos ---

function valorCampo(id) {
	const el = document.getElementById(id);
	return el ? el.value.trim() : "";
}

function valorNumero(id) {
	const bruto = valorCampo(id);
	if (bruto === "") return 0;
	const numero = Number.parseInt(bruto, 10);
	return Number.isNaN(numero) ? NaN : numero;
}

function validarFormulario() {
	const dados = {
		nome: valorCampo("hospitalNome"),
		localizacao: valorCampo("hospitalLocalizacao"),
		wallet: valorCampo("hospitalWallet"),
		vagasGeral: valorNumero("vagasGeral"),
		vagasPediatria: valorNumero("vagasPediatria"),
		vagasOrtopedia: valorNumero("vagasOrtopedia"),
		vagasCardio: valorNumero("vagasCardio")
	};

	if (!dados.nome) throw new Error("Informe o nome do hospital.");
	if (!dados.localizacao) throw new Error("Informe a localização.");
	if (!ethers.isAddress(dados.wallet)) throw new Error("Wallet address inválido.");

	const vagas = [dados.vagasGeral, dados.vagasPediatria, dados.vagasOrtopedia, dados.vagasCardio];
	if (vagas.some((v) => Number.isNaN(v) || v < 0)) {
		throw new Error("As vagas devem ser números inteiros maiores ou iguais a zero.");
	}

	return dados;
}

// --- Registro na blockchain ---

async function registrarNaBlockchain() {
	if (typeof window.ethereum === "undefined") {
		throw new Error("MetaMask não encontrada. Instale a extensão para continuar.");
	}

	const dados = validarFormulario();
	setStatus("Solicitando conexão com a MetaMask...", "info");

	const provider = new ethers.BrowserProvider(window.ethereum);
	await provider.send("eth_requestAccounts", []);
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

	setStatus("Enviando transação para a blockchain...", "info");

	const tx = await contract.registrarHospital(
		dados.nome,
		dados.localizacao,
		dados.wallet,
		dados.vagasGeral,
		dados.vagasPediatria,
		dados.vagasOrtopedia,
		dados.vagasCardio
	);

	setStatus(`Transação enviada: ${tx.hash} · Aguardando confirmação...`, "info");
	const receipt = await tx.wait();

	// Extrai o ID gerado pelo evento HospitalRegistrado
	let idGerado = null;
	try {
		const iface = new ethers.Interface(CONTRACT_ABI);
		for (const log of receipt.logs) {
			try {
				const parsed = iface.parseLog(log);
				if (parsed && parsed.name === "HospitalRegistrado") {
					idGerado = Number(parsed.args.id);
					break;
				}
			} catch (_) {}
		}
	} catch (_) {}

	setStatus(`✅ Hospital registrado no bloco ${receipt.blockNumber}!`, "ok");

	// Exibe o link para gestão de vagas com o ID preenchido
	if (idGerado !== null) {
		document.getElementById("hospitalIdRegistrado").textContent = idGerado;
		const linkEl = document.getElementById("btnIrGestao");
		linkEl.href = `../gestao_de_vagas/index.html?hospitalId=${idGerado}`;
		document.getElementById("linkGestao").style.display = "block";

		// Salva o ID no localStorage para que a página de gestão pré-preencha
		localStorage.setItem("hospitalIdCadastrado", String(idGerado));
	}
}

// --- Event listeners ---

document.getElementById("btnCadastrar").addEventListener("click", async () => {
	document.getElementById("btnCadastrar").disabled = true;
	try {
		await registrarNaBlockchain();
	} catch (error) {
		const mensagem = error && error.message ? error.message : "Falha ao registrar hospital na blockchain.";
		setStatus(`❌ ${mensagem}`, "erro");
	} finally {
		document.getElementById("btnCadastrar").disabled = false;
	}
});

// --- Inicialização ---
verificarConexao();

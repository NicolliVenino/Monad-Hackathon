// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HospitalRegistry {
    struct Vagas {
        uint256 geral;
        uint256 pediatria;
        uint256 ortopedia;
        uint256 cardio;
    }

    struct Hospital {
        uint256 id;
        string nome;
        string localizacao;
        address wallet;
        Vagas vagas;
        uint256 criadoEm;
    }

    uint256 private _proximoId = 1;
    mapping(uint256 => Hospital) private _hospitaisPorId;
    mapping(address => uint256[]) private _idsPorWallet;

    event HospitalRegistrado(
        uint256 indexed id,
        address indexed wallet,
        string nome,
        string localizacao,
        uint256 geral,
        uint256 pediatria,
        uint256 ortopedia,
        uint256 cardio,
        uint256 criadoEm
    );

    event VagasAtualizadas(
        uint256 indexed id,
        address indexed atualizador,
        uint256 geral,
        uint256 pediatria,
        uint256 ortopedia,
        uint256 cardio,
        uint256 atualizadoEm
    );

    function registrarHospital(
        string calldata nome,
        string calldata localizacao,
        address wallet,
        uint256 vagasGeral,
        uint256 vagasPediatria,
        uint256 vagasOrtopedia,
        uint256 vagasCardio
    ) external returns (uint256 idGerado) {
        require(bytes(nome).length > 0, "Nome obrigatorio");
        require(bytes(localizacao).length > 0, "Localizacao obrigatoria");
        require(wallet != address(0), "Wallet invalida");

        idGerado = _proximoId;
        _proximoId += 1;

        Hospital memory hospital = Hospital({
            id: idGerado,
            nome: nome,
            localizacao: localizacao,
            wallet: wallet,
            vagas: Vagas({
                geral: vagasGeral,
                pediatria: vagasPediatria,
                ortopedia: vagasOrtopedia,
                cardio: vagasCardio
            }),
            criadoEm: block.timestamp
        });

        _hospitaisPorId[idGerado] = hospital;
        _idsPorWallet[wallet].push(idGerado);

        emit HospitalRegistrado(
            idGerado,
            wallet,
            nome,
            localizacao,
            vagasGeral,
            vagasPediatria,
            vagasOrtopedia,
            vagasCardio,
            block.timestamp
        );
    }

    function obterHospital(uint256 id) external view returns (Hospital memory) {
        require(id > 0 && id < _proximoId, "Hospital nao encontrado");
        return _hospitaisPorId[id];
    }

    function atualizarVagas(
        uint256 hospitalId,
        uint256 vagasGeral,
        uint256 vagasPediatria,
        uint256 vagasOrtopedia,
        uint256 vagasCardio
    ) external {
        require(hospitalId > 0 && hospitalId < _proximoId, "Hospital nao encontrado");

        Hospital storage hospital = _hospitaisPorId[hospitalId];
        require(msg.sender == hospital.wallet, "Apenas a wallet do hospital pode atualizar vagas");

        hospital.vagas = Vagas({
            geral: vagasGeral,
            pediatria: vagasPediatria,
            ortopedia: vagasOrtopedia,
            cardio: vagasCardio
        });

        emit VagasAtualizadas(
            hospitalId,
            msg.sender,
            vagasGeral,
            vagasPediatria,
            vagasOrtopedia,
            vagasCardio,
            block.timestamp
        );
    }

    function listarIdsPorWallet(address wallet) external view returns (uint256[] memory) {
        return _idsPorWallet[wallet];
    }

    function totalHospitais() external view returns (uint256) {
        return _proximoId - 1;
    }
}

function alterarQuantidade(botao, mudanca) {

    const pai = botao.parentElement;

    const display = pai.querySelector('.number-display');

    let valorAtual = parseInt(display.innerText);

    let novoValor = valorAtual + mudanca;

    if (novoValor < 0) {
        novoValor = 0;
    }

    display.innerText = novoValor;
}

Selector('.btn-send');
btnEnviar.addEventListener('click', () => {
    
    const itens = document.querySelectorAll('.item-row');
    let resumo = "Pedido:\n";

    itens.forEach(item => {
        const nome = item.querySelector('.label-box').innerText;
        const qtd = item.querySelector('.number-display').innerText;
        if (qtd > 0) resumo += `${nome}: ${qtd}\n`;
    });

    alert(resumo === "Pedido:\n" ? "Selecione pelo menos um item!" : resumo);
});
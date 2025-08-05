import { db, getItensCadastrados, ref, push, remove, update, get } from './firebase.js';
import './styles.css';

document.addEventListener("DOMContentLoaded", () => {
  renderHome();

  const search = document.getElementById("searchInput");
  if (search) {
    search.addEventListener("input", () => {
      console.log("🔎 Buscando:", search.value);
    });
  }
});

window.navigate = function (section) {
  if (section === 'cadastro') {
    renderCadastro();
  } else if (section === 'estoque') {
    renderEstoque();
 } else if (section === 'faltando') {
    renderItensEmFalta();
 } else if (section === 'controle') {
    renderControle();
 } else if (section === 'historico') {
    renderHistorico();
 } else if (section === 'carrinho') {
    renderCarrinho();  
  } else {
    document.getElementById('main-content').innerHTML = `
      <h2 class="fade-in">Você está em: ${section.toUpperCase()}</h2>
      <p>Conteúdo da seção <strong>${section}</strong> será carregado aqui.</p>
    `;
  }
};

function renderHome() {
  document.getElementById('main-content').innerHTML = `
    <div class="welcome fade-in">
      <h1>Bem-vindo ao Almoxarifado</h1>
      <p>Clique em uma opção do menu acima para começar</p>
    </div>
  `;
}

function renderCadastro() {
  document.getElementById('main-content').innerHTML = `
    <div class="cadastro-container fade-in">
      <h2>Cadastro de Novo Item</h2>
      <form id="cadastroForm" class="cadastro-form">
        <div class="form-group">
          <label>Foto do Item:</label>
          <input type="file" id="fotoItem" accept="image/*" />
          <img id="preview" class="preview-img" style="display:none" />
        </div>
        <div class="form-group">
          <label>Nome do Item:</label>
          <input type="text" id="nomeItem" required />
        </div>
        <div class="form-group">
          <label>Onde Compra:</label>
          <input type="text" id="ondeCompra" />
        </div>
        <div class="form-group">
          <label>Código:</label>
          <input type="text" id="codigoItem" required />
        </div>
        <div class="form-group">
          <label>Quantidade Inicial:</label>
          <input type="number" id="quantidade" min="0" />
        </div>
        <div class="form-group">
          <label>Valor por Unidade (R$):</label>
          <input type="number" step="0.01" id="valorUnitario" />
        </div>
        <div class="form-group">
          <label>Total Estimado:</label>
          <input type="text" id="valorTotal" disabled />
        </div>
        <div class="form-group">
          <label>Notas/Informações:</label>
          <textarea id="notaItem"></textarea>
        </div>
        <div class="form-group">
          <label>Alerta quando abaixo de:</label>
          <input type="number" id="limiteAlerta" min="1" />
        </div>
        <button type="submit" class="btn-cadastrar">Criar Item</button>
      </form>
    </div>
  `;

  document.getElementById('fotoItem').addEventListener('change', previewImage);
  document.getElementById('quantidade').addEventListener('input', atualizarTotal);
  document.getElementById('valorUnitario').addEventListener('input', atualizarTotal);
  document.getElementById('cadastroForm').addEventListener('submit', cadastrarItem);
}

function previewImage(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = document.getElementById('preview');
      img.src = event.target.result;
      img.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function atualizarTotal() {
  const q = parseFloat(document.getElementById('quantidade').value) || 0;
  const v = parseFloat(document.getElementById('valorUnitario').value) || 0;
  document.getElementById('valorTotal').value = `R$ ${(q * v).toFixed(2)}`;
}

async function cadastrarItem(e) {
  e.preventDefault();

  const item = {
    nome: document.getElementById('nomeItem').value,
    ondeCompra: document.getElementById('ondeCompra').value,
    codigo: document.getElementById('codigoItem').value,
    quantidade: parseInt(document.getElementById('quantidade').value),
    valorUnitario: parseFloat(document.getElementById('valorUnitario').value),
    nota: document.getElementById('notaItem').value,
    limiteAlerta: parseInt(document.getElementById('limiteAlerta').value)
  };

  try {
    await push(ref(db, 'itens'), item);
    alert("✅ Item cadastrado com sucesso!");
    renderEstoque();
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
    alert("❌ Erro ao salvar no Firebase");
  }
}

async function renderEstoque() {
  const container = document.getElementById('main-content');
  let itens = await getItensCadastrados();

  // 💰 Calcular total antes de usar
const totalEstoque = itens.reduce((sum, it) => sum + (it.quantidade * it.valorUnitario), 0);
const totalFormatted = totalEstoque.toFixed(2);

// Cria container de info e botões
const infoContainer = document.createElement('div');
infoContainer.style.margin = '16px 0';
infoContainer.innerHTML = `<p style="font-weight:bold;">Valor total em estoque: R$ ${totalFormatted}</p>`;


  const infoTotalHTML = `<p style="margin-top:16px; font-weight:bold;">
    Valor total em estoque: R$ ${totalFormatted}
  </p>`;

const btnCSV = document.createElement('button');
btnCSV.textContent = 'Exportar CSV';
btnCSV.className = 'btn-cadastrar';
btnCSV.onclick = () => exportarCSV(itens);
infoContainer.appendChild(btnCSV);


const btnXLSX = document.createElement('button');
btnXLSX.textContent = 'Exportar Excel (.xlsx)';
btnXLSX.className = 'btn-cadastrar';
btnXLSX.style.marginLeft = '8px';
btnXLSX.onclick = () => exportarExcel(itens);
infoContainer.appendChild(btnXLSX);


container.appendChild(infoContainer);


  container.innerHTML = `
    <h2>Estoque Atual</h2>
    <input type="text" id="filtroEstoque"
      placeholder="🔎 Filtrar por nome ou código..."
      style="margin-bottom: 16px; padding: 8px; width: 100%; max-width: 400px;" />
    ${infoTotalHTML}
    <div id="estoqueLista" class="estoque-grid">🔄 Carregando...</div>
  `;

  const listaDiv = document.getElementById('estoqueLista');

  function exibirLista(filtrados) {
    if (filtrados.length === 0) {
      listaDiv.innerHTML = '<p>Nenhum item encontrado.</p>';
      return;
    }

    listaDiv.innerHTML = filtrados.map(item => `
      <div class="item-card fade-in" data-id="${item.id}">
        ${item.quantidade <= item.limiteAlerta ? '<span class="estoque-alerta-dot"></span>' : ''}
        <div class="img-placeholder">Buscando imagem...</div>
        <h3>${item.nome}</h3>
        <p><strong>Código:</strong> ${item.codigo}</p>
        <p><strong>Quantidade:</strong> ${item.quantidade}</p>
        <div class="extra-info">
          <p><strong>Valor:</strong> R$ ${item.valorUnitario.toFixed(2)}</p>
          <p><strong>Total:</strong> R$ ${(item.quantidade * item.valorUnitario).toFixed(2)}</p>
          <p><strong>Onde compra:</strong> ${item.ondeCompra || '-'}</p>
          <p><strong>Notas:</strong> ${item.nota || '-'}</p>
        </div>
        <div class="item-actions">
          <button class="action-btn edit-btn" data-id="${item.id}">Editar</button>
          <button class="action-btn delete-btn" data-id="${item.id}">Excluir</button>
          <button class="action-btn adjust-btn" data-id="${item.id}" data-type="add">+ Qtd</button>
          <button class="action-btn adjust-btn" data-id="${item.id}" data-type="sub">– Qtd</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.item-card').forEach(card =>
      card.addEventListener('click', () => openItemModal(card.dataset.id))
    );

    document.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', () => showEditPrompt(btn.dataset.id))
    );
    document.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => deleteItem(btn.dataset.id))
    );
    document.querySelectorAll('.adjust-btn').forEach(btn =>
      btn.addEventListener('click', () => adjustQuantity(btn.dataset.id, btn.dataset.type))
    );
  }

  exibirLista(itens);

  document.getElementById('filtroEstoque').addEventListener('input', e => {
    const termo = e.target.value.toLowerCase();
    const filtrados = itens.filter(item =>
      item.nome.toLowerCase().includes(termo) ||
      item.codigo.toLowerCase().includes(termo)
    );
    exibirLista(filtrados);
  });
}


function deleteItem(id) {
  if (confirm('Tem certeza que quer excluir este item?')) {
    remove(ref(db, `itens/${id}`))
      .then(renderEstoque)
      .catch(err => alert('Erro ao excluir: ' + err.message));
  }
}

function showEditPrompt(id) {
  const newName = prompt('Novo nome:');
  if (!newName) return;
  update(ref(db, `itens/${id}`), { nome: newName })
    .then(renderEstoque)
    .catch(err => alert('Erro ao editar: ' + err.message));
}

async function adjustQuantity(id, type) {
  const snapshot = await get(ref(db, `itens/${id}`));
  if (!snapshot.exists()) return alert('Item não encontrado.');
  const item = snapshot.val();
  const amount = parseInt(prompt('Quantidade para ' + (type === 'add' ? 'adicionar' : 'remover') + ':'));
  if (isNaN(amount) || amount <= 0) return;
  const newQty = type === 'add' ? item.quantidade + amount : item.quantidade - amount;
  update(ref(db, `itens/${id}`), { quantidade: newQty })
    .then(renderEstoque)
    .catch(err => alert('Erro ao ajustar quantidade: ' + err.message));
}

async function openItemModal(id) {
  const snapshot = await get(ref(db, `itens/${id}`));
  if (!snapshot.exists()) return alert('Item não encontrado.');

  const item = snapshot.val();

  const modalHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="item-modal">
        <button class="modal-close-btn" id="closeModalBtn">&times;</button>
        <h2>${item.nome}</h2>
        <p><strong>Código:</strong> ${item.codigo}</p>
        <p><strong>Quantidade:</strong> ${item.quantidade}</p>
        <p><strong>Valor (un):</strong> R$ ${item.valorUnitario.toFixed(2)}</p>
        <p><strong>Total:</strong> R$ ${(item.quantidade * item.valorUnitario).toFixed(2)}</p>
        <p><strong>Onde compra:</strong> ${item.ondeCompra || '-'}</p>
        <p><strong>Notas:</strong> ${item.nota || '-'}</p>
        <div class="item-actions" style="justify-content: flex-end;">
          <button class="action-btn edit-btn" data-id="${id}">Editar</button>
          <button class="action-btn delete-btn" data-id="${id}">Excluir</button>
          <button class="action-btn adjust-btn" data-id="${id}" data-type="add">+ Qtd</button>
          <button class="action-btn adjust-btn" data-id="${id}" data-type="sub">– Qtd</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.getElementById('closeModalBtn').onclick = closeModal;
  document.getElementById('modalBackdrop').onclick = e => {
    if (e.target.id === 'modalBackdrop') closeModal();
  };

  // botões dentro da modal
  document.querySelector('.item-modal .edit-btn').onclick = () => {
    closeModal();
    showEditPrompt(id);
  };
  document.querySelector('.item-modal .delete-btn').onclick = () => {
    closeModal();
    deleteItem(id);
  };
  document.querySelectorAll('.item-modal .adjust-btn').forEach(btn =>
    btn.onclick = () => {
      closeModal();
      adjustQuantity(id, btn.dataset.type);
    }
  );
}

function closeModal() {
  const backdrop = document.getElementById('modalBackdrop');
  if (backdrop) backdrop.remove();
}
async function renderItensEmFalta() {
  const itens = await getItensCadastrados();
  const faltando = itens.filter(item => item.quantidade <= item.limiteAlerta);
  
  const conteudo = `
    <h2>Itens em Falta</h2>
    <div class="estoque-grid">${faltando.length 
      ? faltando.map(item => `
          <div class="item-card fade-in">
            <h3>${item.nome}</h3>
            <p>Qtd: ${item.quantidade}</p>
            <p>Limite: ${item.limiteAlerta}</p>
          </div>
        `).join('') 
      : '<p>Não há itens faltando.</p>'}
    </div>`;
  document.getElementById('main-content').innerHTML = conteudo;
}
async function renderControle() {
  const itens = await getItensCadastrados();

  const opcoes = itens.map(item => `<option value="${item.id}">${item.nome} (Qtd: ${item.quantidade})</option>`).join('');

  const html = `
    <h2>Registrar Uso de Item</h2>
    <form id="controleForm" class="cadastro-form" style="max-width: 500px; margin: auto;">
      <div class="form-group">
        <label for="usuario">Nome do Usuário:</label>
        <input type="text" id="usuario" required />
      </div>
      <div class="form-group">
        <label for="itemSelecionado">Selecione o Item:</label>
        <select id="itemSelecionado" required>
          <option value="">-- Selecione --</option>
          ${opcoes}
        </select>
      </div>
      <div class="form-group">
        <label for="quantidadeUsada">Quantidade Utilizada:</label>
        <input type="number" id="quantidadeUsada" min="1" required />
      </div>
      <button type="submit" class="btn-cadastrar">Registrar Uso</button>
    </form>
  `;

  document.getElementById('main-content').innerHTML = html;
  document.getElementById('controleForm').addEventListener('submit', registrarUso);
}
async function registrarUso(e) {
  e.preventDefault();

  const usuario = document.getElementById('usuario').value.trim();
  const idItem = document.getElementById('itemSelecionado').value;
  const quantidade = parseInt(document.getElementById('quantidadeUsada').value);

  if (!usuario || !idItem || !quantidade || quantidade <= 0) {
    return alert("❌ Preencha todos os campos corretamente.");
  }

  const snapshot = await get(ref(db, `itens/${idItem}`));
  if (!snapshot.exists()) return alert('Item não encontrado.');

  const item = snapshot.val();

  if (quantidade > item.quantidade) {
    return alert(`❌ Estoque insuficiente. Disponível: ${item.quantidade}`);
  }

  const novaQuantidade = item.quantidade - quantidade;

  try {
    await update(ref(db, `itens/${idItem}`), { quantidade: novaQuantidade });

    const log = {
      usuario,
      item: item.nome,
      codigo: item.codigo,
      tipo: 'retirada',
      quantidade,
      timestamp: new Date().toISOString()
    };

    await push(ref(db, 'historico'), log);

    alert("✅ Uso registrado com sucesso!");
    renderControle();
  } catch (err) {
    console.error(err);
    alert("❌ Erro ao registrar uso");
  }
}
async function renderHistorico() {
  const container = document.getElementById('main-content');
  container.innerHTML = `
    <h2> Histórico de Uso</h2>
    <div id="historicoLista" class="historico-grid">🔄 Carregando...</div>
  `;

  const snapshot = await get(ref(db, 'historico'));

  const historicoDiv = document.getElementById('historicoLista');

  if (!snapshot.exists()) {
    historicoDiv.innerHTML = `<p>Nenhuma movimentação registrada ainda.</p>`;
    return;
  }

  const dados = snapshot.val();
  const logs = Object.values(dados).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  historicoDiv.innerHTML = logs.map(log => `
    <div class="historico-card fade-in">
      <p><strong>Usuário:</strong> ${log.usuario}</p>
      <p><strong>Item:</strong> ${log.item} (${log.codigo})</p>
      <p><strong>Tipo:</strong> ${log.tipo === 'retirada' ? 'Retirada de Estoque' : log.tipo}</p>
      <p><strong>Quantidade:</strong> ${log.quantidade}</p>
      <p><strong>Data:</strong> ${new Date(log.timestamp).toLocaleString('pt-BR')}</p>
    </div>
  `).join('');
}
async function renderCarrinho() {
  const itens = await getItensCadastrados();

  const rows = itens.map(item => `
    <tr>
      <td><input type="checkbox" data-id="${item.id}" data-nome="${item.nome}" data-codigo="${item.codigo}" data-quant="${item.quantidade}" /></td>
      <td>${item.nome}</td>
      <td>${item.codigo}</td>
      <td>${item.quantidade}</td>
      <td><input type="number" min="1" max="${item.quantidade}" class="input-quant" data-id="${item.id}" placeholder="0" style="width: 60px;" /></td>
    </tr>
  `).join('');

  document.getElementById('main-content').innerHTML = `
    <h2>🛒 Carrinho de Retirada</h2>
    <table style="width:100%; border-collapse: collapse;">
      <thead>
        <tr><th>Selecionar</th><th>Item</th><th>Código</th><th>Estoque</th><th>Qtd Retirada</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <button id="confirmarRetirada" class="btn-cadastrar" style="margin-top: 16px;">Confirmar Retirada</button>
  `;

  document.getElementById('confirmarRetirada').onclick = handleConfirmarRetirada;
}
async function handleConfirmarRetirada() {
  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'));
  if (checkboxes.length === 0) return alert('Selecione pelo menos um item.');

  const itemsToRemove = [];

  for (let cb of checkboxes) {
    const id = cb.dataset.id;
    const nome = cb.dataset.nome;
    const codigo = cb.dataset.codigo;
    const estoque = parseInt(cb.dataset.quant);
    const input = document.querySelector(`.input-quant[data-id="${id}"]`);
    const qtd = parseInt(input.value);
    if (!qtd || qtd < 1 || qtd > estoque) {
      return alert(`Quantidade inválida para o item "${nome}".`);
    }
    itemsToRemove.push({ id, nome, codigo, qtd, estoque });
  }

  const usuario = prompt('Nome do responsável pela retirada:');
  if (!usuario) return alert('Nome do usuário é obrigatório.');

  try {
    for (let it of itemsToRemove) {
      await update(ref(db, `itens/${it.id}`), { quantidade: it.estoque - it.qtd });
      await push(ref(db, 'historico'), {
        usuario,
        item: it.nome,
        codigo: it.codigo,
        tipo: 'retirada carrinho',
        quantidade: it.qtd,
        timestamp: new Date().toISOString()
      });
    }
    alert(' Retirada registrada com sucesso!');
    renderCarrinho();
  } catch (err) {
    console.error(err);
    alert('Erro ao processar retirada.');
  }
}
function exportarCSV(itens) {
  const headers = ["Nome", "Código", "Quantidade", "Valor Unitário", "Total"];
  const rows = itens.map(it => [
    it.nome,
    it.codigo,
    it.quantidade,
    it.valorUnitario.toFixed(2),
    (it.quantidade * it.valorUnitario).toFixed(2)
  ]);
  const csv = [headers, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, "estoque.csv");
}

import * as XLSX from 'xlsx'; // ← certifique-se de importar isso no topo do arquivo!

function exportarExcel(itens) {
  const dados = itens.map(it => ({
    Nome: it.nome,
    Código: it.codigo,
    Quantidade: it.quantidade,
    'Valor Unitário': it.valorUnitario,
    Total: (it.quantidade * it.valorUnitario).toFixed(2),
    'Onde Compra': it.ondeCompra || '',
    Notas: it.nota || '',
  }));

  const planilha = XLSX.utils.json_to_sheet(dados);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'Estoque');

  XLSX.writeFile(livro, 'estoque.xlsx');
}
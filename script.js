const API_BASE_URL = "https://buildcontrol-api.vercel.app";

const sessaoSalva = JSON.parse(localStorage.getItem("buildcontrol_session"));

if (!sessaoSalva || !sessaoSalva.access_token) {
  window.location.href = "login.html";
}

let materiais = [];
let guardados = [];
let editandoMaterial = null;
let editandoGuardado = null;
let grafico = null;
let eventoInstalacao = null;
let salvando = false;
let timerSalvamento = null;

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const $ = (id) => document.getElementById(id);

function toast(texto) {
  const antigo = document.querySelector(".toast");
  if (antigo) antigo.remove();

  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = texto;
  document.body.appendChild(div);

  setTimeout(() => div.remove(), 2200);
}

function atualizarStatusSync(texto) {
  const el = $("syncStatus");
  if (el) el.textContent = texto;
}

function lerBackupLocal() {
  return {
    materiais: JSON.parse(localStorage.getItem("buildcontrol_materiais")) || [],
    guardados: JSON.parse(localStorage.getItem("buildcontrol_guardados")) || []
  };
}

function salvarLocal() {
  localStorage.setItem("buildcontrol_materiais", JSON.stringify(materiais));
  localStorage.setItem("buildcontrol_guardados", JSON.stringify(guardados));
}

async function carregarDadosOnline() {
  try {
    atualizarStatusSync("Carregando online...");

    const resposta = await fetch(`${API_BASE_URL}/api/dados`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessaoSalva.access_token}`
      }
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro ao carregar dados:", dados);

      if (resposta.status === 401) {
        localStorage.removeItem("buildcontrol_session");
        localStorage.removeItem("buildcontrol_user");
        window.location.href = "login.html";
        return;
      }

      const backup = lerBackupLocal();
      materiais = backup.materiais;
      guardados = backup.guardados;
      renderizar(false);
      atualizarStatusSync("Erro online");
      toast(dados.erro || "Erro ao carregar dados online.");
      return;
    }

    materiais = Array.isArray(dados.materiais) ? dados.materiais : [];
    guardados = Array.isArray(dados.guardados) ? dados.guardados : [];

    salvarLocal();
    renderizar(false);
    atualizarStatusSync("Online sincronizado");
  } catch (error) {
    console.error("Erro ao carregar online:", error);

    const backup = lerBackupLocal();
    materiais = backup.materiais;
    guardados = backup.guardados;

    renderizar(false);
    atualizarStatusSync("Sem conexão");
    toast("Sem conexão com a API.");
  }
}

async function salvarOnline(forcar = false) {
  salvarLocal();

  if (!sessaoSalva || !sessaoSalva.access_token) return;

  if (salvando) return;

  if (!forcar) {
    clearTimeout(timerSalvamento);
    timerSalvamento = setTimeout(() => salvarOnline(true), 500);
    return;
  }

  try {
    salvando = true;
    atualizarStatusSync("Salvando online...");

    const resposta = await fetch(`${API_BASE_URL}/api/dados`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessaoSalva.access_token}`
      },
      body: JSON.stringify({
        materiais,
        guardados
      })
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro ao salvar online:", resultado);

      if (resposta.status === 401) {
        localStorage.removeItem("buildcontrol_session");
        localStorage.removeItem("buildcontrol_user");
        window.location.href = "login.html";
        return;
      }

      atualizarStatusSync("Erro ao salvar");
      toast(resultado.erro || "Erro ao salvar online.");
      return;
    }

    atualizarStatusSync("Salvo online");
  } catch (error) {
    console.error("Erro de conexão ao salvar:", error);
    atualizarStatusSync("Sem conexão");
    toast("Sem conexão com a API.");
  } finally {
    salvando = false;
  }
}

function atualizarStatusAutomatico() {
  const totalGuardado = guardados.reduce((soma, item) => soma + Number(item.valor || 0), 0);
  let saldoDisponivel = totalGuardado;

  materiais.forEach((item) => {
    const totalMaterial = Number(item.quantidade || 0) * Number(item.valor || 0);

    if (saldoDisponivel >= totalMaterial && totalMaterial > 0) {
      item.status = "Concluído";
      saldoDisponivel -= totalMaterial;
    } else if (saldoDisponivel > 0) {
      item.status = "Parcial";
      saldoDisponivel = 0;
    } else {
      item.status = "Pendente";
    }
  });
}

function salvarMaterial() {
  const nome = $("nomeMaterial").value.trim();
  const quantidade = Number($("quantidadeMaterial").value);
  const valor = Number($("valorMaterial").value);

  if (!nome || quantidade <= 0 || valor <= 0) {
    toast("Preencha todos os campos do material.");
    return;
  }

  const novoMaterial = {
    nome,
    quantidade,
    valor,
    status: "Pendente"
  };

  if (editandoMaterial !== null) {
    materiais[editandoMaterial] = novoMaterial;
    toast("Material atualizado.");
  } else {
    materiais.push(novoMaterial);
    toast("Material adicionado.");
  }

  cancelarEdicaoMaterial();
  renderizar(true);
}

function editarMaterial(index) {
  const item = materiais[index];
  if (!item) return;

  $("nomeMaterial").value = item.nome;
  $("quantidadeMaterial").value = item.quantidade;
  $("valorMaterial").value = item.valor;

  editandoMaterial = index;
  $("btnMaterial").textContent = "Salvar";
  $("cancelarMaterial").classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoMaterial() {
  editandoMaterial = null;

  $("nomeMaterial").value = "";
  $("quantidadeMaterial").value = "";
  $("valorMaterial").value = "";

  $("btnMaterial").textContent = "+ Adicionar";
  $("cancelarMaterial").classList.add("hidden");
}

function excluirMaterial(index) {
  if (!confirm("Deseja excluir este material?")) return;

  materiais.splice(index, 1);
  renderizar(true);
  toast("Material excluído.");
}

function salvarGuardado() {
  const mes = $("mesGuardado").value.trim();
  const valor = Number($("valorGuardadoInput").value);

  if (!mes || valor <= 0) {
    toast("Preencha o mês e o valor.");
    return;
  }

  const novo = {
    mes,
    valor
  };

  if (editandoGuardado !== null) {
    guardados[editandoGuardado] = novo;
    toast("Valor atualizado.");
  } else {
    guardados.push(novo);
    toast("Valor adicionado.");
  }

  cancelarEdicaoGuardado();
  renderizar(true);
}

function editarGuardado(index) {
  const item = guardados[index];
  if (!item) return;

  $("mesGuardado").value = item.mes;
  $("valorGuardadoInput").value = item.valor;

  editandoGuardado = index;
  $("btnGuardado").textContent = "Salvar";
  $("cancelarGuardado").classList.remove("hidden");
}

function cancelarEdicaoGuardado() {
  editandoGuardado = null;

  $("mesGuardado").value = "";
  $("valorGuardadoInput").value = "";

  $("btnGuardado").textContent = "+ Adicionar";
  $("cancelarGuardado").classList.add("hidden");
}

function excluirGuardado(index) {
  if (!confirm("Deseja excluir este valor?")) return;

  guardados.splice(index, 1);
  renderizar(true);
  toast("Valor excluído.");
}

function limparTexto(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function obterIconeMaterial(nome) {
  const texto = String(nome || "").toLowerCase();

  if (texto.includes("telha")) {
    return { emoji: "🏠", tipo: "tipo-telha" };
  }

  if (texto.includes("cimento")) {
    return { emoji: "🪣", tipo: "tipo-cimento" };
  }

  if (texto.includes("areia")) {
    return { emoji: "⛰️", tipo: "tipo-areia" };
  }

  if (texto.includes("pedra") || texto.includes("brita")) {
    return { emoji: "🪨", tipo: "tipo-pedra" };
  }

  if (texto.includes("tijolo") || texto.includes("bloco")) {
    return { emoji: "🧱", tipo: "tipo-tijolo" };
  }

  if (texto.includes("ferro") || texto.includes("aço") || texto.includes("aco") || texto.includes("vergalhão")) {
    return { emoji: "⚙️", tipo: "tipo-ferro" };
  }

  if (texto.includes("madeira") || texto.includes("tábua") || texto.includes("tabua")) {
    return { emoji: "🪵", tipo: "tipo-madeira" };
  }

  if (texto.includes("tinta")) {
    return { emoji: "🎨", tipo: "tipo-tinta" };
  }

  if (texto.includes("cano") || texto.includes("tubo")) {
    return { emoji: "🔵", tipo: "tipo-cano" };
  }

  if (texto.includes("fio") || texto.includes("cabo")) {
    return { emoji: "🔌", tipo: "tipo-fio" };
  }

  if (texto.includes("porta")) {
    return { emoji: "🚪", tipo: "tipo-porta" };
  }

  if (texto.includes("janela")) {
    return { emoji: "🪟", tipo: "tipo-janela" };
  }

  return { emoji: "📦", tipo: "tipo-default" };
}

function renderizarMateriais() {
  const lista = $("listaMateriais");
  lista.innerHTML = "";

  if (materiais.length === 0) {
    lista.innerHTML = `
      <tr>
        <td colspan="6" class="empty">Nenhum material adicionado ainda</td>
      </tr>
    `;
    return;
  }

  materiais.forEach((item, index) => {
    const total = Number(item.quantidade || 0) * Number(item.valor || 0);

    const classe = String(item.status || "Pendente")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const infoIcone = obterIconeMaterial(item.nome);

    lista.innerHTML += `
      <tr class="material-row">
        <td class="material-name" data-label="Material">
          <div class="material-cell">
           <span class="material-icon material-emoji ${infoIcone.tipo}">
  ${infoIcone.emoji}
</span>

            </span>

            <strong>${limparTexto(item.nome)}</strong>
          </div>
        </td>

        <td data-label="Qtd">${limparTexto(item.quantidade)}</td>

        <td data-label="Valor unit.">
          ${moeda.format(Number(item.valor || 0))}
        </td>

        <td data-label="Total">
          ${moeda.format(total)}
        </td>

        <td data-label="Status">
          <span class="status ${classe}">
            ${limparTexto(item.status)}
          </span>
        </td>

        <td data-label="Ações">
          <div class="actions">
            <button class="icon-btn edit-btn" onclick="editarMaterial(${index})" title="Editar">
              <i data-lucide="pencil"></i>
            </button>

            <button class="icon-btn delete-btn" onclick="excluirMaterial(${index})" title="Excluir">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderizarGuardados() {
  const lista = $("listaGuardado");
  lista.innerHTML = "";

  const totalGuardado = guardados.reduce(
    (soma, item) => soma + Number(item.valor || 0),
    0
  );

  const totalRodape = $("totalGuardadoRodape");
  if (totalRodape) {
    totalRodape.textContent = moeda.format(totalGuardado);
  }

  if (guardados.length === 0) {
    lista.innerHTML = `
      <div class="money-empty">
        Nenhum mês adicionado ainda
      </div>
    `;
    return;
  }

  const metade = Math.ceil(guardados.length / 2);
  const primeiraColuna = guardados.slice(0, metade);
  const segundaColuna = guardados.slice(metade);

  function criarTabela(itens, inicioIndex) {
    return `
      <div class="money-table">
        <div class="money-table-head">
          <span>Mês</span>
          <span>Valor guardado (R$)</span>
          <span>Ações</span>
        </div>

        ${itens.map((item, i) => {
          const index = inicioIndex + i;

          return `
            <div class="money-table-row">
              <div class="money-month">
                <i data-lucide="calendar-days"></i>
                <span>${limparTexto(item.mes)}</span>
              </div>

              <strong>${moeda.format(Number(item.valor || 0))}</strong>

              <div class="actions money-actions">
                <button class="icon-btn edit-btn" onclick="editarGuardado(${index})" title="Editar">
                  <i data-lucide="pencil"></i>
                </button>

                <button class="icon-btn delete-btn" onclick="excluirGuardado(${index})" title="Excluir">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  lista.innerHTML = `
    ${criarTabela(primeiraColuna, 0)}
    ${criarTabela(segundaColuna, metade)}
  `;

  if (window.lucide) {
    lucide.createIcons();
  }
}

function atualizarResumo() {
  const totalMateriais = materiais.reduce(
    (soma, item) => soma + Number(item.quantidade || 0) * Number(item.valor || 0),
    0
  );

  const totalGuardado = guardados.reduce(
    (soma, item) => soma + Number(item.valor || 0),
    0
  );

  const faltaPagar = Math.max(totalMateriais - totalGuardado, 0);

  const totalMateriaisEl = $("totalMateriais");
  const totalGuardadoEl = $("totalGuardado");
  const faltaPagarEl = $("faltaPagar");

  if (totalMateriaisEl) {
    totalMateriaisEl.textContent = moeda.format(totalMateriais);
  }

  if (totalGuardadoEl) {
    totalGuardadoEl.textContent = moeda.format(totalGuardado);
  }

  if (faltaPagarEl) {
    faltaPagarEl.textContent = moeda.format(faltaPagar);
  }

  const qtdMateriaisResumo = $("qtdMateriaisResumo");
  const qtdMesesResumo = $("qtdMesesResumo");
  const porcentagemFalta = $("porcentagemFalta");
  const totalGuardadoRodape = $("totalGuardadoRodape");

  if (qtdMateriaisResumo) {
    const textoItem = materiais.length === 1 ? "item cadastrado" : "itens cadastrados";
    qtdMateriaisResumo.textContent = `${materiais.length} ${textoItem}`;
  }

  if (qtdMesesResumo) {
    const textoMes = guardados.length === 1 ? "mês registrado" : "meses registrados";
    qtdMesesResumo.textContent = `${guardados.length} ${textoMes}`;
  }

  if (porcentagemFalta) {
    const percentual = totalMateriais > 0
      ? Math.round((faltaPagar / totalMateriais) * 100)
      : 0;

    porcentagemFalta.textContent = `${percentual}% do total`;
  }

  if (totalGuardadoRodape) {
    totalGuardadoRodape.textContent = moeda.format(totalGuardado);
  }
}
function atualizarGrafico() {
  const canvas = $("graficoGuardado");
  if (!canvas || typeof Chart === "undefined") return;

  if (grafico) grafico.destroy();

  const labels = guardados.map((item) => item.mes);
  const valores = guardados.map((item) => Number(item.valor || 0));

  grafico = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: valores,
          backgroundColor: "rgba(59, 130, 246, 0.78)",
          borderColor: "rgba(96, 165, 250, 1)",
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#b8b8b8",
            font: {
              size: 10
            }
          },
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#b8b8b8",
            font: {
              size: 10
            },
            callback: function (value) {
              return moeda.format(value).replace(",00", "");
            }
          },
          grid: {
            color: "rgba(255, 255, 255, .06)"
          }
        }
      }
    }
  });
}

function resetarTudo() {
  if (!confirm("Tem certeza que deseja apagar tudo?")) return;

  materiais = [];
  guardados = [];

  cancelarEdicaoMaterial();
  cancelarEdicaoGuardado();
  renderizar(true);
  toast("Tudo foi resetado.");
}

function renderizar(sincronizar = true) {
  atualizarStatusAutomatico();
  salvarLocal();
  renderizarMateriais();
  renderizarGuardados();
  atualizarResumo();
  atualizarGrafico();

  if (window.lucide) {
    lucide.createIcons();
  }

  if (sincronizar) {
    salvarOnline();
  }
}

function sair() {
  localStorage.removeItem("buildcontrol_session");
  localStorage.removeItem("buildcontrol_user");
  window.location.href = "login.html";
}

function configurarEventos() {
  $("btnMaterial")?.addEventListener("click", salvarMaterial);
  $("cancelarMaterial")?.addEventListener("click", cancelarEdicaoMaterial);
  $("btnGuardado")?.addEventListener("click", salvarGuardado);
  $("cancelarGuardado")?.addEventListener("click", cancelarEdicaoGuardado);
  $("btnResetar")?.addEventListener("click", resetarTudo);
  $("btnSair")?.addEventListener("click", sair);
}

function configurarPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.error);
    });
  }

  const btnInstalar = $("btnInstalar");
  if (!btnInstalar) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    eventoInstalacao = event;
    btnInstalar.classList.remove("hidden");
  });

  btnInstalar.addEventListener("click", async () => {
    if (!eventoInstalacao) return;

    eventoInstalacao.prompt();
    const escolha = await eventoInstalacao.userChoice;

    if (escolha.outcome === "accepted") {
      btnInstalar.classList.add("hidden");
      toast("App instalado com sucesso!");
    }

    eventoInstalacao = null;
  });

  window.addEventListener("appinstalled", () => {
    btnInstalar.classList.add("hidden");
    eventoInstalacao = null;
  });
}

window.editarMaterial = editarMaterial;
window.excluirMaterial = excluirMaterial;
window.editarGuardado = editarGuardado;
window.excluirGuardado = excluirGuardado;
window.sair = sair;

async function iniciar() {
  configurarEventos();
  configurarPWA();

  const backup = lerBackupLocal();
  materiais = backup.materiais;
  guardados = backup.guardados;
  renderizar(false);

  await carregarDadosOnline();
}

iniciar();

if (window.lucide) {
  lucide.createIcons();
}
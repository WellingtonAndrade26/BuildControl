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

    lista.innerHTML += `
      <tr>
        <td>${limparTexto(item.nome)}</td>
        <td>${limparTexto(item.quantidade)}</td>
        <td>${moeda.format(Number(item.valor || 0))}</td>
        <td>${moeda.format(total)}</td>
        <td><span class="status ${classe}">${limparTexto(item.status)}</span></td>
        <td>
          <div class="actions">
            <button class="icon-btn" onclick="editarMaterial(${index})" title="Editar">✎</button>
            <button class="icon-btn" onclick="excluirMaterial(${index})" title="Excluir">🗑</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function renderizarGuardados() {
  const lista = $("listaGuardado");
  lista.innerHTML = "";

  if (guardados.length === 0) {
    lista.innerHTML = `
      <tr>
        <td colspan="3" class="empty">Nenhum mês adicionado ainda</td>
      </tr>
    `;
    return;
  }

  guardados.forEach((item, index) => {
    lista.innerHTML += `
      <tr>
        <td>${limparTexto(item.mes)}</td>
        <td>${moeda.format(Number(item.valor || 0))}</td>
        <td>
          <div class="actions">
            <button class="icon-btn" onclick="editarGuardado(${index})" title="Editar">✎</button>
            <button class="icon-btn" onclick="excluirGuardado(${index})" title="Excluir">🗑</button>
          </div>
        </td>
      </tr>
    `;
  });
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

  $("totalMateriais").textContent = moeda.format(totalMateriais);
  $("totalGuardado").textContent = moeda.format(totalGuardado);
  $("faltaPagar").textContent = moeda.format(faltaPagar);
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
          borderRadius: 4
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
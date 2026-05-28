let materiais = JSON.parse(localStorage.getItem("buildcontrol_materiais")) || [];
let guardados = JSON.parse(localStorage.getItem("buildcontrol_guardados")) || [];

let editandoMaterial = null;
let editandoGuardado = null;
let grafico = null;
let eventoInstalacao = null;

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function salvarLocal() {
  localStorage.setItem("buildcontrol_materiais", JSON.stringify(materiais));
  localStorage.setItem("buildcontrol_guardados", JSON.stringify(guardados));
}

function toast(texto) {
  const antigo = document.querySelector(".toast");
  if (antigo) antigo.remove();

  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = texto;
  document.body.appendChild(div);

  setTimeout(() => div.remove(), 1800);
}

function salvarMaterial() {
  const nome = document.getElementById("nomeMaterial").value.trim();
  const quantidade = Number(document.getElementById("quantidadeMaterial").value);
  const valor = Number(document.getElementById("valorMaterial").value);

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

  salvarLocal();
  cancelarEdicaoMaterial();
  renderizar();
}

function editarMaterial(index) {
  const item = materiais[index];

  document.getElementById("nomeMaterial").value = item.nome;
  document.getElementById("quantidadeMaterial").value = item.quantidade;
  document.getElementById("valorMaterial").value = item.valor;

  editandoMaterial = index;
  document.getElementById("btnMaterial").textContent = "Salvar";
  document.getElementById("cancelarMaterial").classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicaoMaterial() {
  editandoMaterial = null;

  document.getElementById("nomeMaterial").value = "";
  document.getElementById("quantidadeMaterial").value = "";
  document.getElementById("valorMaterial").value = "";

  document.getElementById("btnMaterial").textContent = "+ Adicionar";
  document.getElementById("cancelarMaterial").classList.add("hidden");
}

function excluirMaterial(index) {
  if (!confirm("Deseja excluir este material?")) return;

  materiais.splice(index, 1);
  salvarLocal();
  renderizar();
  toast("Material excluído.");
}

function atualizarStatusAutomatico() {
  const totalGuardado = guardados.reduce((soma, item) => soma + item.valor, 0);
  let saldoDisponivel = totalGuardado;

  materiais.forEach((item) => {
    const totalMaterial = item.quantidade * item.valor;

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

function salvarGuardado() {
  const mes = document.getElementById("mesGuardado").value.trim();
  const valor = Number(document.getElementById("valorGuardadoInput").value);

  if (!mes || valor <= 0) {
    toast("Preencha o mês e o valor.");
    return;
  }

  const novo = { mes, valor };

  if (editandoGuardado !== null) {
    guardados[editandoGuardado] = novo;
    toast("Valor atualizado.");
  } else {
    guardados.push(novo);
    toast("Valor adicionado.");
  }

  salvarLocal();
  cancelarEdicaoGuardado();
  renderizar();
}

function editarGuardado(index) {
  const item = guardados[index];

  document.getElementById("mesGuardado").value = item.mes;
  document.getElementById("valorGuardadoInput").value = item.valor;

  editandoGuardado = index;
  document.getElementById("btnGuardado").textContent = "Salvar";
  document.getElementById("cancelarGuardado").classList.remove("hidden");
}

function cancelarEdicaoGuardado() {
  editandoGuardado = null;

  document.getElementById("mesGuardado").value = "";
  document.getElementById("valorGuardadoInput").value = "";

  document.getElementById("btnGuardado").textContent = "+ Adicionar";
  document.getElementById("cancelarGuardado").classList.add("hidden");
}

function excluirGuardado(index) {
  if (!confirm("Deseja excluir este valor?")) return;

  guardados.splice(index, 1);
  salvarLocal();
  renderizar();
  toast("Valor excluído.");
}

function renderizarMateriais() {
  const lista = document.getElementById("listaMateriais");
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
    const total = item.quantidade * item.valor;
    const classe = item.status
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    lista.innerHTML += `
      <tr>
        <td>${item.nome}</td>
        <td>${item.quantidade}</td>
        <td>${moeda.format(item.valor)}</td>
        <td>${moeda.format(total)}</td>
        <td><span class="status ${classe}">${item.status}</span></td>
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
  const lista = document.getElementById("listaGuardado");
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
        <td>${item.mes}</td>
        <td>${moeda.format(item.valor)}</td>
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
  const totalMateriais = materiais.reduce((soma, item) => soma + item.quantidade * item.valor, 0);
  const totalGuardado = guardados.reduce((soma, item) => soma + item.valor, 0);
  const faltaPagar = Math.max(totalMateriais - totalGuardado, 0);

  document.getElementById("totalMateriais").textContent = moeda.format(totalMateriais);
  document.getElementById("totalGuardado").textContent = moeda.format(totalGuardado);
  document.getElementById("faltaPagar").textContent = moeda.format(faltaPagar);
}

function atualizarGrafico() {
  const canvas = document.getElementById("graficoGuardado");

  if (grafico) grafico.destroy();

  const labels = guardados.map(item => item.mes);
  const valores = guardados.map(item => item.valor);

  grafico = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: "rgba(59, 130, 246, 0.78)",
        borderColor: "rgba(96, 165, 250, 1)",
        borderWidth: 1,
        borderRadius: 4
      }]
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
            callback: function(value) {
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
  salvarLocal();
  cancelarEdicaoMaterial();
  cancelarEdicaoGuardado();
  renderizar();
  toast("Tudo foi resetado.");
}

function renderizar() {
  atualizarStatusAutomatico();
  salvarLocal();
  renderizarMateriais();
  renderizarGuardados();
  atualizarResumo();
  atualizarGrafico();
}

function configurarPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js");
    });
  }

  const btnInstalar = document.getElementById("btnInstalar");

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

renderizar();
configurarPWA();

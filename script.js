// =============================
// DADOS
// =============================
let materiais = JSON.parse(localStorage.getItem("materiais")) || []
let guardadoPorMes = JSON.parse(localStorage.getItem("guardado")) || {}
let graficoGuardado = null

// =============================
// SALVAR DADOS
// =============================
function salvarDados() {
  localStorage.setItem("materiais", JSON.stringify(materiais))
  localStorage.setItem("guardado", JSON.stringify(guardadoPorMes))
}

// =============================
// TOAST (MENSAGEM BONITA)
// =============================
function mostrarMensagem(msg) {
  const toast = document.createElement("div")
  toast.innerText = msg
  toast.className = "toast"
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = "0"
    toast.style.transform = "translateY(20px)"
  }, 1800)

  setTimeout(() => toast.remove(), 2200)
}

// =============================
// ADICIONAR MATERIAL
// =============================
function adicionarMaterial() {
  const material = document.getElementById("material").value.trim()
  const quantidade = Number(document.getElementById("quantidade").value)
  const valor = Number(document.getElementById("valor").value)

  if (material === "" || quantidade <= 0 || valor <= 0) {
    mostrarMensagem("Preencha tudo corretamente!")
    return
  }

  materiais.push({ material, quantidade, valor })

  salvarDados()
  limparCamposMaterial()
  mostrarMateriais()
  calcularResumo()

  mostrarMensagem("Material adicionado com sucesso!")
}

// =============================
// MOSTRAR MATERIAIS
// =============================
function mostrarMateriais() {
  const tabela = document.getElementById("tabelaMateriais")
  tabela.innerHTML = ""

  materiais.forEach((item, index) => {
    const total = item.quantidade * item.valor

    tabela.innerHTML += `
      <tr>
        <td>${item.material}</td>
        <td>${item.quantidade}</td>
        <td>R$ ${item.valor.toFixed(2)}</td>
        <td>R$ ${total.toFixed(2)}</td>
        <td>
          <button class="btn-excluir" onclick="excluirMaterial(${index})">
            Excluir
          </button>
        </td>
      </tr>
    `
  })
}

// =============================
// ADICIONAR GUARDADO
// =============================
function adicionarGuardado() {
  const mes = document.getElementById("mes").value.trim()
  const valorMes = Number(document.getElementById("valorMes").value)

  if (mes === "" || valorMes <= 0) {
    mostrarMensagem("Preencha o mês e o valor!")
    return
  }

  if (guardadoPorMes[mes]) {
    guardadoPorMes[mes] += valorMes
  } else {
    guardadoPorMes[mes] = valorMes
  }

  salvarDados()

  document.getElementById("mes").value = ""
  document.getElementById("valorMes").value = ""

  mostrarGuardado()
  calcularResumo()
  atualizarGrafico()

  mostrarMensagem("Valor guardado atualizado!")
}

// =============================
// MOSTRAR GUARDADO
// =============================
function mostrarGuardado() {
  const tabela = document.getElementById("tabelaGuardado")
  tabela.innerHTML = ""

  for (let mes in guardadoPorMes) {
    tabela.innerHTML += `
      <tr>
        <td>${mes}</td>
        <td>R$ ${guardadoPorMes[mes].toFixed(2)}</td>
        <td>
          <button class="btn-excluir" onclick="excluirGuardado('${mes}')">
            Excluir
          </button>
        </td>
      </tr>
    `
  }
}

// =============================
// GRAFICO DO GUARDADO NO MES
// =============================

function atualizarGrafico() {
  const canvas = document.getElementById("graficoGuardado")

  if (!canvas) return

  const meses = Object.keys(guardadoPorMes)
  const valores = Object.values(guardadoPorMes)

  if (graficoGuardado) {
    graficoGuardado.destroy()
  }

  const ctx = canvas.getContext("2d")

  const gradient = ctx.createLinearGradient(0, 0, 0, 180)
  gradient.addColorStop(0, "#38bdf8")
  gradient.addColorStop(1, "#1d4ed8")

  graficoGuardado = new Chart(canvas, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [
        {
          label: "Valor guardado R$",
          data: valores,
          backgroundColor: gradient,
          borderColor: "#38bdf8",
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: true
        }
      },

      scales: {
        x: {
          ticks: {
            font: { size: 10 }
          }
        },
        y: {
          ticks: {
            font: { size: 10 }
          },
          beginAtZero: true
        }
      }
    }
  })
}
// =============================
// RESUMO
// =============================
function calcularResumo() {
  const totalMateriais = materiais.reduce((soma, item) => {
    return soma + (item.quantidade * item.valor)
  }, 0)

  const totalGuardado = Object.values(guardadoPorMes).reduce((soma, valor) => {
    return soma + valor
  }, 0)

  const falta = totalMateriais - totalGuardado

  document.getElementById("totalMateriais").innerText = `R$ ${totalMateriais.toFixed(2)}`
  document.getElementById("valorGuardado").innerText = `R$ ${totalGuardado.toFixed(2)}`
  document.getElementById("faltaPagar").innerText = `R$ ${falta > 0 ? falta.toFixed(2) : "0.00"}`
}

// =============================
// LIMPAR CAMPOS
// =============================
function limparCamposMaterial() {
  document.getElementById("material").value = ""
  document.getElementById("quantidade").value = ""
  document.getElementById("valor").value = ""
}

// =============================
// EXCLUIR MATERIAL
// =============================
function excluirMaterial(index) {
  if (confirm("Deseja excluir este material?")) {
    materiais.splice(index, 1)
    salvarDados()
    mostrarMateriais()
    calcularResumo()

    mostrarMensagem("Material removido!")
  }
}

// =============================
// EXCLUIR GUARDADO
// =============================
function excluirGuardado(mes) {
  if (confirm("Deseja excluir esse valor guardado?")) {
    delete guardadoPorMes[mes]
    salvarDados()
    mostrarGuardado()
    calcularResumo()
    atualizarGrafico()

    mostrarMensagem("Valor removido!")
  }
}

// =============================
// RESET TOTAL
// =============================
function resetarTudo() {
  if (confirm("Tem certeza que quer apagar tudo?")) {
    localStorage.clear()
    location.reload()
  }
}

// =============================
// INICIAR APP
// =============================
function iniciar() {
  mostrarMateriais()
  mostrarGuardado()
  calcularResumo()
  atualizarGrafico()
}

iniciar()
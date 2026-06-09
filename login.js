const API_BASE_URL = " https://buildcontrol-api.vercel.app";



document.addEventListener("DOMContentLoaded", () => {
  const tabLogin = document.getElementById("tabLogin");
  const tabCadastro = document.getElementById("tabCadastro");
  const authForm = document.getElementById("authForm");
  const nomeUsuario = document.getElementById("nomeUsuario");
  const emailUsuario = document.getElementById("emailUsuario");
  const senhaUsuario = document.getElementById("senhaUsuario");
  const btnAuth = document.getElementById("btnAuth");
  const authMensagem = document.getElementById("authMensagem");

  let modoCadastro = false;

  function mostrarMensagem(texto, tipo = "") {
    if (!authMensagem) return;
    authMensagem.textContent = texto;
    authMensagem.className = `auth-message ${tipo}`;
  }

  function atualizarTela() {
    if (modoCadastro) {
      tabCadastro.classList.add("active");
      tabLogin.classList.remove("active");
      nomeUsuario.classList.remove("hidden");
      btnAuth.textContent = "Cadastrar";
      senhaUsuario.placeholder = "Crie uma senha";
    } else {
      tabLogin.classList.add("active");
      tabCadastro.classList.remove("active");
      nomeUsuario.classList.add("hidden");
      btnAuth.textContent = "Entrar";
      senhaUsuario.placeholder = "Senha";
    }

    mostrarMensagem("");
  }

  tabLogin.addEventListener("click", () => {
    modoCadastro = false;
    atualizarTela();
  });

  tabCadastro.addEventListener("click", () => {
    modoCadastro = true;
    atualizarTela();
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = nomeUsuario.value.trim();
    const email = emailUsuario.value.trim();
    const senha = senhaUsuario.value.trim();

    if (!email || !senha) {
      mostrarMensagem("Preencha email e senha.", "erro");
      return;
    }

    if (modoCadastro && !nome) {
      mostrarMensagem("Preencha seu nome.", "erro");
      return;
    }

    btnAuth.disabled = true;
    btnAuth.textContent = modoCadastro ? "Cadastrando..." : "Entrando...";

    try {
      const endpoint = modoCadastro ? "/api/cadastro" : "/api/login";

      const resposta = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nome,
          email,
          senha
        })
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        mostrarMensagem(resultado.erro || "Erro ao processar.", "erro");
        return;
      }

      if (modoCadastro) {
        mostrarMensagem("Cadastro criado. Agora faça login.", "sucesso");

        modoCadastro = false;
        atualizarTela();

        nomeUsuario.value = "";
        senhaUsuario.value = "";
        return;
      }

      localStorage.setItem("buildcontrol_session", JSON.stringify(resultado.session));
      localStorage.setItem("buildcontrol_user", JSON.stringify(resultado.usuario));

      window.location.href = "index.html";
    } catch (error) {
      console.error(error);
      mostrarMensagem("Erro de conexão com a API.", "erro");
    } finally {
      btnAuth.disabled = false;
      btnAuth.textContent = modoCadastro ? "Cadastrar" : "Entrar";
    }
  });

  atualizarTela();
});
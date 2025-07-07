const DIAS = ["segunda", "terça", "quarta", "quinta", "sexta"];
const coresMembros = {};
const ajustes = [];
let filtroNome = null;
let usuarioAlterouMaximo = false;
let ultimoMembroRemovido = null;
let modoInvertido = true;
let ultimaEscala = null;
let ultimaMembros = null;
let ultimaMax = null;

function corAleatoria() {
  const h = Math.floor(Math.random() * 360);
  const s = 70 + Math.floor(Math.random() * 20);
  const l = 40 + Math.floor(Math.random() * 20);
  return `hsl(${h},${s}%,${l}%)`;
}
function corTextoContraste(bgColor) {
  let rgb;
  if (bgColor.startsWith('hsl')) {
    const [h, s, l] = bgColor.match(/\d+/g).map(Number);
    rgb = hslToRgb(h / 360, s / 100, l / 100);
  } else {
    rgb = hexToRgb(bgColor);
  }
  const luminancia = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminancia > 0.5 ? "#222" : "#fff";
}
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function hexToRgb(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function gerarSugestoes(erros, contexto) {
  const sugestoes = [];
  const { qtdMembros, min, max, diasPorPessoa, qtdDias, evitarConsecutivos } = contexto;
  erros.forEach(erro => {
    if (erro.includes("mínimo de pessoas por dia")) {
      sugestoes.push("Reduza o valor do campo 'Mínimo por dia' ou adicione mais membros.");
    }
    if (erro.includes("máximo de pessoas por dia")) {
      sugestoes.push("Reduza o valor do campo 'Máximo por dia' ou adicione mais membros.");
    }
    if (erro.includes("não é possível preencher o mínimo")) {
      sugestoes.push("Aumente o número de membros, reduza o 'Mínimo por dia' ou aumente 'Dias por pessoa'.");
    }
    if (erro.includes("excede o máximo permitido")) {
      sugestoes.push("Aumente o 'Máximo por dia', reduza 'Dias por pessoa' ou adicione mais dias na semana.");
    }
    if (erro.includes("evitar 3 dias seguidos")) {
      sugestoes.push(`Reduza 'Dias por pessoa' para no máximo ${Math.ceil(qtdDias / 2)} ou desmarque a opção 'Evitar 3 dias seguidos'.`);
    }
    if (erro.includes("menor que o mínimo")) {
      sugestoes.push("Adicione mais membros ou reduza o 'Mínimo por dia'.");
    }
    if (erro.includes("não foi possível alocar o mínimo")) {
      sugestoes.push("Verifique se há muitos membros indisponíveis em determinados dias.");
      sugestoes.push("Tente flexibilizar as preferências de disponibilidade dos membros.");
    }
    if (erro.includes("não foi possível alocar o mínimo de dias para")) {
      sugestoes.push("Reduza o número de dias obrigatórios por pessoa ou aumente o número de membros.");
      sugestoes.push("Permita que membros trabalhem em dias consecutivos, se possível.");
    }
    if (erro.includes("não foi possível gerar a escala")) {
      sugestoes.push("Revise as preferências dos membros para evitar bloqueios.");
      sugestoes.push("Considere permitir trocas entre membros disponíveis.");
    }
    if (erro.includes("Preencha todos os nomes")) {
      sugestoes.push("Preencha todos os nomes antes de tentar gerar a escala.");
    }
  });
  sugestoes.push("Dica: Tente deixar pelo menos um membro disponível em todos os dias.");
  sugestoes.push("Dica: Evite marcar todos os dias como indisponível para algum membro.");
  sugestoes.push("Dica: Se possível, aumente o número de membros para maior flexibilidade.");
  return [...new Set(sugestoes)];
}

function tentarTrocarParaAlocar(escala, membros, dia, min, max, diasPorPessoa, evitarConsecutivos) {
  for (let membro of membros.filter(m => !m.diasAlocados.includes(dia) && m.diasAlocados.length < diasPorPessoa && (!m.pref[dia] || m.pref[dia] === "sim"))) {
    for (let i = 0; i < escala[dia].length; i++) {
      const alocado = escala[dia][i];
      if (alocado.tipo === "preferido" || alocado.tipo === "nao") continue;
      for (let outroDia of DIAS) {
        if (outroDia === dia) continue;
        if ((!membro.diasAlocados.includes(outroDia)) &&
            (!membro.pref[outroDia] || membro.pref[outroDia] === "sim") &&
            (!escala[outroDia].some(p => p.nome === membro.nome)) &&
            escala[outroDia].length < max &&
            (!evitarConsecutivos || !viola3DiasSeguidos(membro, outroDia))) {
          if ((!alocado.tipo || alocado.tipo === "sim" || alocado.tipo === "neutro") &&
              (!membros.find(m => m.nome === alocado.nome).pref[outroDia] || membros.find(m => m.nome === alocado.nome).pref[outroDia] === "sim")) {
            escala[dia][i] = { nome: membro.nome, tipo: membro.pref[dia] || "neutro" };
            membro.diasAlocados.push(dia);
            escala[outroDia].push({ nome: outro.nome, tipo: outroMembro.pref[outroDia] || "neutro" });
            membros.find(m => m.nome === alocado.nome).diasAlocados.push(outroDia);
            return true;
          }
        }
      }
    }
  }
  return false;
}

function renderizarEscalaNormal(escala, max) {
  const body = document.getElementById("escala-body");
  body.innerHTML = "";
  const thead = document.querySelector("#escala-table thead");
  thead.innerHTML = `<tr><th>Dia</th><th>Membros</th></tr>`;

  for (let dia of DIAS) {
    const nomesOrdenados = escala[dia].slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const row = document.createElement("tr");
    const nomes = nomesOrdenados.map(p => {
      const cor = coresMembros[p.nome] || "#666";
      const emoji = p.tipo === "preferido" ? "⭐" : p.tipo === "sim" ? "✅" : p.tipo === "nao" ? "⛔" : "";
      const corTexto = corTextoContraste(cor);
      return `<span class="nome-colorido" 
        style="background-color:${cor};color:${corTexto};cursor:pointer"
        onclick="filtrarPorNome('${p.nome}')"
        title="Clique para filtrar por este nome"
        >${emoji} ${p.nome}</span>`;
    }).join(" ");
    row.innerHTML = `<td>
      ${dia.charAt(0).toUpperCase() + dia.slice(1)}<br>
      <span style="font-size:0.95em;color:#888">(${nomesOrdenados.length}/${max})</span>
    </td>
    <td>${nomes}</td>`;
    row.setAttribute("data-dia", dia);
    body.appendChild(row);
  }
}

function gerarEscala() {
  document.getElementById("mensagemErro").innerText = "";
  document.getElementById("mensagemInfo").innerText = "";
  ajustes.length = 0;
  let nomesEmBranco = false;
  document.querySelectorAll("#membros-body tr").forEach(tr => {
    const nomeInput = tr.children[0].querySelector("input");
    if (!nomeInput.value.trim()) {
      nomeInput.style.backgroundColor = "#ffcccc";
      nomesEmBranco = true;
    } else {
      const nome = nomeInput.value.trim();
      if (nome && coresMembros[nome]) {
        nomeInput.style.backgroundColor = coresMembros[nome];
        nomeInput.style.color = corTextoContraste(coresMembros[nome]);
      } else {
        nomeInput.style.backgroundColor = "white";
        nomeInput.style.color = "#222";
      }
    }
  });
  if (nomesEmBranco) {
    document.getElementById("mensagemErro").innerText = "Preencha todos os nomes antes de gerar a escala.";
    return;
  }
  const min = parseInt(document.getElementById("minPorDia").value);
  const max = parseInt(document.getElementById("maxPorDia").value);
  let evitarConsecutivos = document.getElementById("evitarConsecutivos").checked;
  const diasPorPessoa = parseInt(document.getElementById("diasPorPessoa").value);
  const membros = [];
  const linhas = document.querySelectorAll("#membros-body tr");
  linhas.forEach(tr => {
    const nomeInput = tr.children[0].querySelector("input");
    const nome = nomeInput.value.trim();
    if (!nome) return;
    if (!coresMembros[nome]) {
      const cor = corAleatoria();
      coresMembros[nome] = cor;
    }
    nomeInput.style.backgroundColor = coresMembros[nome];
    nomeInput.style.color = corTextoContraste(coresMembros[nome]);
    const pref = {};
    DIAS.forEach((dia, i) => {
      pref[dia] = tr.children[i + 1].querySelector("select").value;
    });
    membros.push({ nome, pref, diasAlocados: [] });
  });
  let erros = [];
  const qtdMembros = membros.length;
  const qtdDias = DIAS.length;
  if (min > qtdMembros) {
    erros.push(`O mínimo de pessoas por dia (${min}) é maior que o número de membros cadastrados (${qtdMembros}).`);
  }
  if (max > qtdMembros) {
    erros.push(`O máximo de pessoas por dia (${max}) é maior que o número de membros cadastrados (${qtdMembros}).`);
  }
  if (qtdMembros * diasPorPessoa < qtdDias * min) {
    erros.push(
      `Com ${qtdMembros} membros e cada um podendo trabalhar em até ${diasPorPessoa} dia(s), não é possível preencher o mínimo de ${min} pessoas em todos os ${qtdDias} dias da semana.`
    );
  }
  if (qtdMembros * diasPorPessoa > qtdDias * max) {
    erros.push(
      `Com ${qtdMembros} membros e cada um devendo trabalhar em ${diasPorPessoa} dia(s), seria necessário alocar mais de ${max} pessoas por dia, o que excede o máximo permitido.`
    );
  }
  if (evitarConsecutivos && diasPorPessoa > Math.ceil(qtdDias / 2)) {
    erros.push(
      `Com a restrição de evitar 3 dias seguidos, cada pessoa só pode ser escalada em até ${Math.ceil(qtdDias / 2)} dia(s).`
    );
  }
  if (qtdMembros < min) {
    erros.push(
      `O número de membros (${qtdMembros}) é menor que o mínimo de pessoas por dia (${min}).`
    );
  }
  if (erros.length > 0) {
    const contexto = { qtdMembros, min, max, diasPorPessoa, qtdDias, evitarConsecutivos };
    const sugestoes = gerarSugestoes(erros, contexto);
    document.getElementById("mensagemErro").innerText =
      "Não é possível gerar a escala devido a:\n- " + erros.join("\n- ") +
      (sugestoes.length ? "\n\nSugestões para resolver:\n- " + sugestoes.join("\n- ") : "");
    return;
  }
  const escala = {};
  DIAS.forEach(dia => escala[dia] = []);
  function tentarAlocar() {
    const prioridades = ["preferido", "sim"];
    for (let prioridade of prioridades) {
      for (let dia of DIAS) {
        let candidatos = membros.filter(m =>
          m.diasAlocados.length < diasPorPessoa &&
          m.pref[dia] === prioridade &&
          !escala[dia].some(p => p.nome === m.nome)
        );
        for (let candidato of candidatos) {
          if (escala[dia].length < max) {
            if (evitarConsecutivos && viola3DiasSeguidos(candidato, dia)) continue;
            escala[dia].push({ nome: candidato.nome, tipo: prioridade });
            candidato.diasAlocados.push(dia);
          }
        }
      }
    }
    for (let dia of DIAS) {
      let tentativas = 0;
      while (escala[dia].length < min && tentativas < 100) {
        tentativas++;
        let candidatos = membros
          .filter(m =>
            m.diasAlocados.length < diasPorPessoa &&
            (!m.pref[dia] || m.pref[dia] !== "nao") &&
            !escala[dia].some(p => p.nome === m.nome)
          )
          .sort((a, b) => a.diasAlocados.length - b.diasAlocados.length);
        if (candidatos.length === 0) break;
        for (let candidato of candidatos) {
          if (escala[dia].length >= min) break;
          if (evitarConsecutivos && viola3DiasSeguidos(candidato, dia)) continue;
          escala[dia].push({ nome: candidato.nome, tipo: candidato.pref[dia] || "neutro" });
          candidato.diasAlocados.push(dia);
        }
      }
      let trocou = true;
      let tentativasTroca = 0;
      while (escala[dia].length < min && trocou && tentativasTroca < 10) {
        trocou = tentarTrocarParaAlocar(escala, membros, dia, min, max, diasPorPessoa, evitarConsecutivos);
        tentativasTroca++;
      }
    }
    for (let membro of membros) {
      let tentativas = 0;
      while (membro.diasAlocados.length < diasPorPessoa && tentativas < 100) {
        tentativas++;
        let diasDisponiveis = DIAS.filter(dia =>
          !membro.diasAlocados.includes(dia) &&
          (!membro.pref[dia] || membro.pref[dia] !== "nao") &&
          escala[dia].length < max &&
          !escala[dia].some(p => p.nome === membro.nome)
        );
        diasDisponiveis.sort((a, b) => escala[a].length - escala[b].length);
        let diaEscolhido = diasDisponiveis.find(dia => !evitarConsecutivos || !viola3DiasSeguidos(membro, dia));
        if (!diaEscolhido) break;
        escala[diaEscolhido].push({ nome: membro.nome, tipo: membro.pref[diaEscolhido] || "neutro" });
        membro.diasAlocados.push(diaEscolhido);
      }
      let trocou = true;
      let tentativasTroca = 0;
      while (membro.diasAlocados.length < diasPorPessoa && trocou && tentativasTroca < 10) {
        for (let dia of DIAS) {
          if (membro.diasAlocados.includes(dia) || (membro.pref[dia] && membro.pref[dia] === "nao")) continue;
          trocou = tentarTrocarParaAlocar(escala, membros, dia, min, max, diasPorPessoa, evitarConsecutivos);
          if (membro.diasAlocados.length >= diasPorPessoa) break;
        }
        tentativasTroca++;
      }
    }
  }
  tentarAlocar();
  let diasComProblema = DIAS.filter(dia => escala[dia].length < min);
  let membrosComProblema = membros.filter(m => m.diasAlocados.length < diasPorPessoa);
  if (diasComProblema.length > 0 || membrosComProblema.length > 0) {
    document.getElementById("mensagemErro").innerHTML =
      "Não foi possível gerar a escala seguindo as regras definidas. Quer que eu tente reorganizar a escala flexibilizando regras?<br>" +
      `<button id="btnForcarAjuste" style="margin-top:8px">Forçar reorganização</button>`;
    document.getElementById("mensagemInfo").innerText = "";
    document.getElementById("escala-body").innerHTML = "";
    document.getElementById("btnForcarAjuste").onclick = function() {
      const ajustes = [];
      for (let dia of diasComProblema) {
        while (escala[dia].length < min && escala[dia].length < max) {
          let candidato = membros.find(m =>
            !m.diasAlocados.includes(dia) &&
            (!m.pref[dia] || m.pref[dia] === "") &&
            m.diasAlocados.length < diasPorPessoa
          );
          if (!candidato) {
            candidato = membros.find(m =>
              !m.diasAlocados.includes(dia) &&
              m.pref[dia] === "sim" &&
              m.diasAlocados.length < diasPorPessoa
            );
          }
          if (!candidato) {
            candidato = membros.find(m =>
              !m.diasAlocados.includes(dia) &&
              m.pref[dia] === "preferido" &&
              m.diasAlocados.length < diasPorPessoa
            );
          }
          if (!candidato) break;
          escala[dia].push({ nome: candidato.nome, tipo: candidato.pref[dia] || "neutro" });
          candidato.diasAlocados.push(dia);
          ajustes.push(`Alocado ${candidato.nome} em ${dia} (preferência: ${candidato.pref[dia] || "neutro"})`);
        }
      }
      let membrosNaoAlocados = [];
      for (let membro of membros) {
        let conseguiu = true;
        while (membro.diasAlocados.length < diasPorPessoa) {
          let dia = DIAS.find(d =>
            !membro.diasAlocados.includes(d) &&
            (!membro.pref[d] || membro.pref[d] === "") &&
            escala[d].length < max &&
            !escala[d].some(p => p.nome === membro.nome)
          );
          if (!dia) {
            dia = DIAS.find(d =>
              !membro.diasAlocados.includes(d) &&
              membro.pref[d] === "sim" &&
              escala[d].length < max &&
              !escala[d].some(p => p.nome === membro.nome)
            );
          }
          if (!dia) {
            dia = DIAS.find(d =>
              !membro.diasAlocados.includes(d) &&
              membro.pref[d] === "preferido" &&
              escala[d].length < max &&
              !escala[d].some(p => p.nome === membro.nome)
            );
          }
          if (!dia) {
            // BLOCO DE TROCA
            let trocou = false;
            for (let d of DIAS) {
              if (
                !membro.diasAlocados.includes(d) &&
                membro.pref[d] !== "nao" &&
                escala[d].length >= max
              ) {
                for (let i = 0; i < escala[d].length; i++) {
                  let outro = escala[d][i];
                  let outroMembro = membros.find(m => m.nome === outro.nome);
                  let outroDia = DIAS.find(od =>
                    !outroMembro.diasAlocados.includes(od) &&
                    outroMembro.pref[od] !== "nao" &&
                    escala[od].length < max &&
                    !escala[od].some(p => p.nome === outro.nome)
                  );
                  if (outroDia) {
                    escala[outroDia].push({ nome: outro.nome, tipo: outroMembro.pref[outroDia] || "neutro" });
                    outroMembro.diasAlocados.push(outroDia);
                    escala[d][i] = { nome: membro.nome, tipo: membro.pref[d] || "neutro" };
                    membro.diasAlocados.push(d);
                    ajustes.push(`Trocou ${outro.nome} de ${d} para ${outroDia}, alocando ${membro.nome} em ${d}`);
                    trocou = true;
                    break;
                  }
                }
                if (trocou) break;
              }
            }
            if (!trocou) {
              conseguiu = false;
              break;
            }
            continue;
          }
          escala[dia].push({ nome: membro.nome, tipo: membro.pref[dia] || "neutro" });
          membro.diasAlocados.push(dia);
          ajustes.push(`Alocado ${membro.nome} em ${dia} (preferência: ${membro.pref[dia] || "neutro"})`);
        }
        if (!conseguiu) membrosNaoAlocados.push(membro.nome);
      }
      if (membrosNaoAlocados.length > 0) {
        let explicacoes = membrosNaoAlocados.map(nome => {
          const membro = membros.find(m => m.nome === nome);
          let faltam = [];
          for (let d of DIAS) {
            if (!membro.diasAlocados.includes(d)) {
              if (membro.pref[d] === "nao") {
                faltam.push(`${d.charAt(0).toUpperCase() + d.slice(1)} (Indisponível)`);
              } else if (escala[d].length >= max) {
                faltam.push(`${d.charAt(0).toUpperCase() + d.slice(1)} (Limite atingido)`);
              } else {
                faltam.push(`${d.charAt(0).toUpperCase() + d.slice(1)}`);
              }
            }
          }
          return `- ${nome}: não foi possível alocar em ${faltam.join(", ")}`;
        }).join("<br>");
        document.getElementById("mensagemErro").innerHTML =
          "Não foi possível garantir o mínimo de dias por pessoa para:<br>" +
          explicacoes +
          "<br>Revise o máximo por dia, as preferências de disponibilidade ou ajuste as restrições para permitir mais flexibilidade na escala.";
        document.getElementById("mensagemInfo").innerText = "";
        return;
      }
      renderizarEscalaInvertida(escala, membros, max);
      document.getElementById("mensagemErro").innerText = "";
      document.getElementById("mensagemInfo").innerHTML =
        "Escala gerada forçando ajustes.<br><b>Ajustes realizados:</b><br>" +
        ajustes.map(a => "- " + a).join("<br>");
      aplicarFiltroNome();
    };
    return;
  }
  renderizarEscalaInvertida(escala, membros, max);
  document.getElementById("mensagemInfo").innerText = "Escala gerada com sucesso.";
  aplicarFiltroNome();

  ultimaEscala = escala;
  ultimaMembros = membros;
  ultimaMax = max;

}

function renderizarEscalaInvertida(escala, membros, max) {
  const body = document.getElementById("escala-body");
  body.innerHTML = "";
  const thead = document.querySelector("#escala-table thead");
  thead.innerHTML = `<tr>
    <th>Nome</th>
    ${DIAS.map(dia => `<th>${dia.charAt(0).toUpperCase() + dia.slice(1)}<br><span style="font-size:0.95em;color:#888">(${(escala[dia]||[]).length}/${max})</span></th>`).join("")}
  </tr>`;

  const nomesOrdenados = membros.map(m => m.nome).sort((a, b) => a.localeCompare(b));
  nomesOrdenados.forEach(nome => {
    const tr = document.createElement("tr");
    const tdNome = document.createElement("td");
    tdNome.textContent = nome;
    tdNome.style.backgroundColor = coresMembros[nome] || "#666";
    tdNome.style.color = corTextoContraste(coresMembros[nome] || "#666");
    tr.appendChild(tdNome);

    DIAS.forEach(dia => {
      const td = document.createElement("td");
      const alocado = (escala[dia] || []).find(p => p.nome === nome);
      if (alocado) {
        const emoji = alocado.tipo === "preferido" ? "⭐" : alocado.tipo === "sim" ? "✅" : alocado.tipo === "nao" ? "⛔" : "";
        td.innerHTML = `<span class="nome-colorido"
          style="background-color:${coresMembros[nome] || "#666"};color:${corTextoContraste(coresMembros[nome] || "#666")};padding:2px 6px;border-radius:4px"
          title="${alocado.tipo || "neutro"}">${emoji} ${nome}</span>`;
      }
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function viola3DiasSeguidos(membro, novoDia) {
  const todos = [...membro.diasAlocados, novoDia].map(d => DIAS.indexOf(d)).sort((a, b) => a - b);
  for (let i = 0; i < todos.length - 2; i++) {
    if (todos[i + 1] === todos[i] + 1 && todos[i + 2] === todos[i] + 2) {
      return true;
    }
  }
  return false;
}

function filtrarPorNome(nome) {
  if (filtroNome === nome) {
    filtroNome = null;
  } else {
    filtroNome = nome;
  }
  aplicarFiltroNome();
}

function aplicarFiltroNome() {
  const linhas = document.querySelectorAll("#escala-body tr");
  linhas.forEach(tr => {
    const nomes = tr.querySelectorAll(".nome-colorido");
    let encontrou = false;
    nomes.forEach(span => {
      if (!filtroNome) {
        span.style.display = "";
        span.style.outline = "";
        encontrou = true;
      } else if (span.textContent.trim().replace(/^(\⭐|✅|⛔|⬛)\s*/, "") === filtroNome) {
        span.style.display = "";
        span.style.outline = "2px solid #222";
        encontrou = true;
      } else {
        span.style.display = "none";
        span.style.outline = "";
      }
    });
    tr.style.display = (!filtroNome || encontrou) ? "" : "none";
  });
}

function baixarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });
  const tabela = document.getElementById("escala-table");
  html2canvas(tabela).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    doc.text("Escala de Trabalho", pageWidth / 2, 40, { align: "center" });
    doc.addImage(imgData, "PNG", 20, 60, imgWidth, imgHeight);
    doc.save("escala.pdf");
  });
}

function baixarPNG() {
  const tabela = document.getElementById("escala-table");
  html2canvas(tabela).then(canvas => {
    const link = document.createElement('a');
    link.download = 'escala.png';
    link.href = canvas.toDataURL();
    link.click();
  });
}

function baixarPlanilha() {
  const wb = XLSX.utils.book_new();
  const ws_data = [["Nome", ...DIAS.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1))]];
  const body = document.getElementById("escala-body");
  const trs = Array.from(body.querySelectorAll("tr"));
  trs.forEach(tr => {
    const tds = Array.from(tr.querySelectorAll("td"));
    const linha = [tds[0].textContent];
    for (let i = 1; i < tds.length; i++) {
      linha.push(tds[i].textContent.trim());
    }
    ws_data.push(linha);
  });
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Escala");
  XLSX.writeFile(wb, "escala.xlsx");
}

function imprimirEscala() {
  window.print();
}

function preencherAleatorio() {
  const opcoes = ["", "preferido", "sim", "nao"];
  const linhas = document.querySelectorAll("#membros-body tr");
  linhas.forEach(tr => {
    for (let i = 1; i <= DIAS.length; i++) {
      const select = tr.children[i].querySelector("select");
      select.value = opcoes[Math.floor(Math.random() * opcoes.length)];
    }
  });
  salvarNoCache();
}

function salvarNoCache() {
  const membros = [];
  document.querySelectorAll("#membros-body tr").forEach(tr => {
    const nome = tr.children[0].querySelector("input").value.trim();
    const dias = [];
    for (let i = 1; i <= DIAS.length; i++) {
      dias.push(tr.children[i].querySelector("select").value);
    }
    membros.push({ nome, dias });
  });
  const config = {
    membros,
    minPorDia: document.getElementById("minPorDia").value,
    maxPorDia: document.getElementById("maxPorDia").value,
    diasPorPessoa: document.getElementById("diasPorPessoa").value,
    evitarConsecutivos: document.getElementById("evitarConsecutivos").checked
  };
  localStorage.setItem("escalaCache", JSON.stringify(config));
}

function carregarDoCache() {
  const cache = localStorage.getItem("escalaCache");
  if (!cache) return;
  const config = JSON.parse(cache);
  document.getElementById("membros-body").innerHTML = "";
  if (config.membros) {
    config.membros.forEach(m => adicionarMembro(m.nome, m.dias));
  }
  if (config.minPorDia) document.getElementById("minPorDia").value = config.minPorDia;
  if (config.maxPorDia) document.getElementById("maxPorDia").value = config.maxPorDia;
  if (config.diasPorPessoa) document.getElementById("diasPorPessoa").value = config.diasPorPessoa;
  if (typeof config.evitarConsecutivos !== "undefined") document.getElementById("evitarConsecutivos").checked = !!config.evitarConsecutivos;
  usuarioAlterouMaximo = true;
  validarLimites();
}

function monitorarAlteracoes() {
  document.getElementById("minPorDia").addEventListener("input", salvarNoCache);
  document.getElementById("maxPorDia").addEventListener("input", salvarNoCache);
  document.getElementById("diasPorPessoa").addEventListener("input", salvarNoCache);
  document.getElementById("evitarConsecutivos").addEventListener("change", salvarNoCache);
  document.getElementById("membros-body").addEventListener("input", salvarNoCache);
  document.getElementById("membros-body").addEventListener("change", salvarNoCache);
}

function adicionarMembro(nome = "", dias = []) {
  const tr = document.createElement("tr");
  const tdNome = document.createElement("td");
  const nomeInput = document.createElement("input");
  nomeInput.placeholder = "Nome";
  nomeInput.value = nome;
  nomeInput.addEventListener("input", () => {
    const nome = nomeInput.value.trim();
    if (nome && !coresMembros[nome]) {
      const cor = corAleatoria();
      coresMembros[nome] = cor;
      nomeInput.style.backgroundColor = cor;
      nomeInput.style.color = corTextoContraste(cor);
    } else if (nome && coresMembros[nome]) {
      nomeInput.style.backgroundColor = coresMembros[nome];
      nomeInput.style.color = corTextoContraste(coresMembros[nome]);
    } else {
      nomeInput.style.backgroundColor = "white";
      nomeInput.style.color = "#222";
    }
  });
  tdNome.appendChild(nomeInput);
  tr.appendChild(tdNome);
  DIAS.forEach((dia, idx) => {
    const td = document.createElement("td");
    const select = document.createElement("select");
    [
      {v: "", t: ""},
      {v: "preferido", t: "⭐ Preferido"},
      {v: "sim", t: "✅ Disponível"},
      {v: "nao", t: "⛔ Indisponível"}
    ].forEach(optObj => {
      const opt = document.createElement("option");
      opt.value = optObj.v;
      opt.textContent = optObj.t;
      select.appendChild(opt);
    });
    if (dias && dias[idx]) select.value = dias[idx];
    td.appendChild(select);
    tr.appendChild(td);
  });
  const tdRemover = document.createElement("td");
  const btnRemover = document.createElement("button");
  btnRemover.type = "button";
  btnRemover.title = "Remover membro";
  btnRemover.textContent = "🗑️";
  btnRemover.onclick = function() {
    removerMembro(tr);
  };
  tdRemover.appendChild(btnRemover);
  tr.appendChild(tdRemover);
  document.getElementById("membros-body").appendChild(tr);
  atualizarMaximoPorDia();
  validarLimites();
  salvarNoCache();
}

function removerMembro(tr) {
  const tds = tr.querySelectorAll("td");
  const nome = tds[0].querySelector("input").value;
  const dias = [];
  for (let i = 1; i <= DIAS.length; i++) {
    dias.push(tds[i].querySelector("select").value);
  }
  ultimoMembroRemovido = { nome, dias, index: Array.from(tr.parentNode.children).indexOf(tr) };
  tr.remove();
  validarLimites();
  salvarNoCache();
}

window.addEventListener("keydown", function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && ultimoMembroRemovido) {
    const { nome, dias, index } = ultimoMembroRemovido;
    const tbody = document.getElementById("membros-body");
    const tr = document.createElement("tr");
    adicionarMembro(nome, dias);
    const trs = Array.from(tbody.children);
    tbody.insertBefore(trs[trs.length - 1], tbody.children[index]);
    ultimoMembroRemovido = null;
    validarLimites();
    salvarNoCache();
  }
});

function atualizarMaximoPorDia() {
  const linhas = document.querySelectorAll("#membros-body tr").length;
  const maxInput = document.getElementById("maxPorDia");
  if (!usuarioAlterouMaximo) {
    maxInput.value = linhas;
  }
}

function validarLimites() {
  const linhas = document.querySelectorAll("#membros-body tr").length;
  const minInput = document.getElementById("minPorDia");
  const maxInput = document.getElementById("maxPorDia");
  let erro = "";
  minInput.style.backgroundColor = "";
  maxInput.style.backgroundColor = "";
  if (parseInt(minInput.value) > linhas) {
    minInput.style.backgroundColor = "#ffcccc";
    erro = "O mínimo por dia não pode ser maior que o número de pessoas cadastradas.";
  }
  if (parseInt(maxInput.value) > linhas) {
    maxInput.style.backgroundColor = "#ffcccc";
    erro = "O máximo por dia não pode ser maior que o número de pessoas cadastradas.";
  }
  if (erro) {
    document.getElementById("mensagemErro").innerText = erro;
  } else {
    document.getElementById("mensagemErro").innerText = "";
  }
}

window.onload = () => {
  carregarDoCache();
  if (document.querySelectorAll("#membros-body tr").length === 0) {
    adicionarMembro();
  }
  validarLimites();
  monitorarAlteracoes();
};

document.getElementById("btnImportarPlanilha").onclick = function() {
  document.getElementById("inputImportarPlanilha").click();
};

document.getElementById("btnAlternarVisualizacao").addEventListener("click", () => {
  modoInvertido = !modoInvertido;
  if (modoInvertido) {
    renderizarEscalaInvertida(ultimaEscala, ultimaMembros, ultimaMax);
  } else {
    renderizarEscalaNormal(ultimaEscala, ultimaMax);
  }
  aplicarFiltroNome();
});


document.getElementById("inputImportarPlanilha").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.name.endsWith(".csv")) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      importarCSV(evt.target.result);
    };
    reader.readAsText(file, "utf-8");
  } else if (file.name.endsWith(".xlsx")) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const ws = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      importarPlanilha(rows);
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert("Formato não suportado. Use CSV ou XLSX.");
  }
});

function importarCSV(text) {
  const rows = text.split(/\r?\n/).map(l => l.split(","));
  importarPlanilha(rows);
}

function importarPlanilha(rows) {
  if (!rows || rows.length < 2) return;
  document.getElementById("membros-body").innerHTML = "";
  const nomes = [];
  const prefsPorMembro = {};
  const header = rows[0].map(h => h.trim().toLowerCase());
  const diasIdx = DIAS.map(dia => header.indexOf(dia));
  for (let i = 1; i < rows.length; i++) {
    const nome = rows[i][0] && rows[i][0].trim();
    if (!nome) continue;
    nomes.push(nome);
    prefsPorMembro[nome] = [];
    diasIdx.forEach((idx, j) => {
      let cell = (rows[i][idx] || "").trim();
      let pref = "";
      if (cell.startsWith("⭐")) pref = "preferido";
      else if (cell.startsWith("✅")) pref = "sim";
      else if (cell.startsWith("⛔")) pref = "nao";
      prefsPorMembro[nome][j] = pref;
    });
  }
  nomes.forEach(nome => adicionarMembro(nome, prefsPorMembro[nome]));
  salvarNoCache && salvarNoCache();
}
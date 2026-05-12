import * as functions from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { Resend } from "resend";

admin.initializeApp();


interface OrcamentoData {
  clienteNome: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  item: string;
  descricao?: string;
  valor?: number;
  status: "pendente" | "em_analise" | "aprovado" | "recusado";
  criadoEm: admin.firestore.Timestamp;
}

export const notificarNovoOrcamento = functions.onDocumentCreated(
  "orcamentos/{docId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as OrcamentoData;
    const docId = event.params.docId;
    const resend = new Resend(process.env.RESEND_API_KEY);

    const dataFormatada = data.criadoEm
      ? data.criadoEm.toDate().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const valorFormatado = data.valor
      ? data.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "Não informado";

    // Busca configurações no Firestore
    const configSnap = await admin
      .firestore()
      .collection("configuracoes")
      .doc("notificacoes")
      .get();

    if (!configSnap.exists) {
      console.log("⚠️ Configuração não encontrada.");
      return;
    }

    const config = configSnap.data() as {
      ativo: boolean;
      destinatarios: string[];
      assunto: string;
      valorMinimo?: number;
    };

    if (!config.ativo) {
      console.log("🔕 Notificação desativada.");
      return;
    }

    if (config.valorMinimo && data.valor !== undefined && data.valor < config.valorMinimo) {
      console.log(`💰 Valor abaixo do mínimo. Pulando.`);
      return;
    }

    const assunto = (config.assunto || "🔔 Novo orçamento recebido — {{cliente}}")
      .replace("{{cliente}}", data.clienteNome)
      .replace("{{valor}}", valorFormatado)
      .replace("{{data}}", dataFormatada);

    const sistemaUrl = `https://gabiink-studio.github.io/site-gabi-ink/${docId}`;

    const htmlEmail = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <tr>
          <td style="background:#01696f;padding:32px 40px;color:white;">
            <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;">🔔 Novo Orçamento Recebido!</h1>
            <p style="margin:0;font-size:14px;opacity:0.85;">Uma solicitação chegou e precisa da sua atenção.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px;">Olá, <strong>Gabi</strong>! 👋</p>
            <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px;">
              Um novo orçamento chegou em <strong>${dataFormatada}</strong>. Acesse o sistema para dar andamento:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0f9f9;border-left:4px solid #01696f;border-radius:0 8px 8px 0;margin:0 0 24px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="4" cellspacing="0" style="font-size:14px;">
                  <tr>
                    <td style="color:#666;width:45%;">Cliente</td>
                    <td style="font-weight:700;color:#01696f;">${data.clienteNome}</td>
                  </tr>
                  ${data.clienteTelefone ? `<tr><td style="color:#666;">Telefone</td><td style="color:#333;">${data.clienteTelefone}</td></tr>` : ""}
                  <tr>
                    <td style="color:#666;">Item / Serviço</td>
                    <td style="color:#333;">${data.item}</td>
                  </tr>
                  ${data.descricao ? `<tr><td style="color:#666;">Descrição</td><td style="color:#333;">${data.descricao}</td></tr>` : ""}
                  <tr>
                    <td style="color:#666;">Valor</td>
                    <td style="font-weight:700;color:#01696f;">${valorFormatado}</td>
                  </tr>
                  <tr>
                    <td style="color:#666;">Data</td>
                    <td style="color:#333;">${dataFormatada}</td>
                  </tr>
                  <tr>
                    <td style="color:#666;">Status</td>
                    <td style="color:#964219;font-weight:600;">⏳ Aguardando análise</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <a href="${sistemaUrl}"
                  style="display:inline-block;background:#01696f;color:#ffffff;text-decoration:none;
                         padding:14px 40px;border-radius:8px;font-size:15px;font-weight:700;">
                  Ver Orçamento no Sistema →
                </a>
              </td></tr>
            </table>
            <p style="font-size:12px;color:#999;margin:0;">
              ⚡ Clientes que recebem retorno em até 2h têm 3× mais chances de fechar o negócio.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f7f6f2;padding:16px 40px;font-size:12px;color:#999;text-align:center;border-top:1px solid #e8e6e2;">
            Enviado automaticamente pelo sistema <strong>Gabi Ink</strong>.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      const { error } = await resend.emails.send({
        from: "Gabi Ink <onboarding@resend.dev>",
        to: config.destinatarios,
        subject: assunto,
        html: htmlEmail,
      });

      if (error) {
        console.error("❌ Erro Resend:", error);
        await registrarHistorico(docId, data, config.destinatarios, "erro", error.message);
        return;
      }

      console.log(`✅ E-mail enviado para: ${config.destinatarios.join(", ")}`);
      await registrarHistorico(docId, data, config.destinatarios, "enviado");

    } catch (err) {
      console.error("❌ Exceção:", err);
    }
  }
);

async function registrarHistorico(
  orcamentoId: string,
  data: OrcamentoData,
  destinatarios: string[],
  status: "enviado" | "erro",
  erroMsg?: string
) {
  await admin.firestore().collection("notificacoes_historico").add({
    orcamentoId,
    clienteNome: data.clienteNome,
    item: data.item,
    destinatarios,
    status,
    erroMsg: erroMsg || null,
    enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
}
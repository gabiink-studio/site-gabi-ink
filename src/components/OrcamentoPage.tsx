import React, { useState, useRef } from "react";
import { db, storage } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { useForm } from "react-hook-form";
import {
  Upload,
  AlertTriangle,
  ImageIcon,
  CheckCircle,
  Instagram,
  MessageCircle,
  X,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER;

const inputBase: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#2B2B2B",
  border: "1px solid #4A4A4A",
  borderRadius: "6px",
  color: "#F0F0F0",
  padding: "12px 16px",
  fontSize: "15px",
  outline: "none",
  fontFamily: "Inter, sans-serif",
  transition: "border-color 0.2s, box-shadow 0.2s",
  boxSizing: "border-box" as const,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#A0A0A0",
  fontFamily: "Montserrat, sans-serif",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "1px",
  textTransform: "uppercase" as const,
  marginBottom: "6px",
};

function maskPhone(value: string): string {
  const nums = value.replace(/\D/g, "").slice(0, 11);
  if (nums.length > 7)
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
  if (nums.length > 2)
    return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return nums ? `(${nums}` : "";
}

type FormData = {
  nome: string;
  whatsapp: string;
  idade: string;
  descricao: string;
  tamanho: string;
  localizacao: string;
};

export function OrcamentoPage() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>();
  const [localizacaoOutro, setLocalizacaoOutro] = useState("");
  const localizacao = watch("localizacao");
  const [phone, setPhone] = useState("");
  const [referenceFile, setReferenceFile] =
    useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [minorState, setMinorState] = useState<
    "none" | "has-auth" | "needs-model"
  >("none");
  const [authFile, setAuthFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const authFileInputRef = useRef<HTMLInputElement>(null);

  const idade = watch("idade");
  const isMinor =
    idade && Number(idade) < 18 && Number(idade) > 0;

  const inputStyle = (field: string): React.CSSProperties => ({
    ...inputBase,
    borderColor:
      focused === field
        ? "#C9A84C"
        : errors[field as keyof FormData]
          ? "#8B1A1A"
          : "#4A4A4A",
    boxShadow: focused === field ? "0 0 0 1px #C9A84C" : "none",
  });

  const handlePhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const masked = maskPhone(e.target.value);
    setPhone(masked);
    setValue("whatsapp", masked);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setReferenceFile(file);
    }
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceFile(file);
    }
  };

  const handleAuthFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) setAuthFile(file);
  };

  const onSubmit = async (data: FormData) => {
    if (isSubmitting) return; // bloqueia duplo clique
    setIsSubmitting(true);
    try {
      let fotoURL = "";
      let autorizacaoURL = "";

      // 1. Upload foto de referência (se houver)
      if (referenceFile) {
        const fotoPath = `referencias/${Date.now()}_${referenceFile.name}`;
        const fotoRef = ref(storage, fotoPath);
        await uploadBytes(fotoRef, referenceFile);
        fotoURL = fotoPath;
      }

      // 2. Upload autorização de menor (se houver)
      if (authFile) {
        const autPath = `autorizacoes/${Date.now()}_${authFile.name}`;
        const autRef = ref(storage, autPath);
        await uploadBytes(autRef, authFile);
        autorizacaoURL = autPath;
      }

      // 3. Salvar no Firestore
      console.log("dados para salvar:", data);
      console.log("referenceFile:", referenceFile);
      console.log("authFile:", authFile);
      await addDoc(collection(db, "budgets"), {
        nome: data.nome,
        whatsapp: data.whatsapp,
        idade: data.idade,
        descricao: data.descricao,
        tamanho: data.tamanho,
        localizacao: data.localizacao,
        fotoReferenciaURL: fotoURL,
        autorizacaoURL: autorizacaoURL,
        criadoEm: serverTimestamp(),
        status: "pendente",
        visualizada: false,
      });
      const message = encodeURIComponent(
        `Olá, Gabiink! Gostaria de solicitar um orçamento:\n\n` +
        `*Nome:* ${data.nome}\n` +
        `*Idade:* ${data.idade} anos\n` +
        `*Descrição:* ${data.descricao}\n` +
        `*Tamanho:* ${data.tamanho}\n` +
        `*Localização:* ${data.localizacao}\n\n` +
        `Aguardo o retorno!`,
      );
      window.open(
        `https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER}?text=${message}`,
        "_blank",
      );
      setSubmitted(true);
    } catch (error) {
      console.error("Erro ao salvar orçamento:", error);
      // Mesmo se o Firestore falhar, ainda abre o WhatsApp
      const message = encodeURIComponent(
        `Olá, GABIINK! Gostaria de solicitar um orçamento:\n\n` +
        `*Nome:* ${data.nome}\n` +
        `*Idade:* ${data.idade} anos\n` +
        `*Descrição:* ${data.descricao}\n` +
        `*Tamanho:* ${data.tamanho}\n` +
        `*Localização:* ${data.localizacao}\n\n` +
        `Aguardo o retorno!`,
      );
      window.open(`https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER}?text=${message}`, "_blank");
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="animate-[fadeIn_0.6s_ease]">
          <h1 className="font-['Playfair_Display'] text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#E2C97E] to-[#C9A84C] tracking-wider">
            GABIINK
          </h1>
        </div>
        <div className="glass-card max-w-md w-full text-center mt-12 p-12 animate-[fadeIn_0.8s_ease_0.2s_both]">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#B89840] mb-6 animate-[glow_2s_ease-in-out_infinite]">
            <CheckCircle size={40} className="text-[#1A1A1A]" />
          </div>
          <h2 className="font-['Playfair_Display'] text-3xl font-bold text-white mb-4">
            Solicitação Enviada!
          </h2>
          <p className="text-gray-300 text-base leading-relaxed mb-8">
            Sua solicitação foi enviada com sucesso. Entraremos
            em contato via WhatsApp em breve.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="btn-gold w-full py-4 text-base font-semibold tracking-wide"
          >
            Novo Orçamento
          </button>
        </div>
      </div>
    );
  }

  return (
    // ✅ DEPOIS
    <div className="min-h-screen" style={{ position: "relative" }}>
      <video autoPlay muted playsInline style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}>
        <source src="/onca4.webm" type="video/webm" />
      </video>
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1 }} />
      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Header */}
        <header className="px-6 pt-16 pb-12 text-center relative">
          <div className="animate-[fadeIn_0.6s_ease]">
            <h1 className="font-['Playfair_Display'] text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#E2C97E] to-[#C9A84C] tracking-wider mb-2">
              GABIINK
            </h1>
            <p className="font-['Montserrat'] text-gray-500 text-xs tracking-[0.3em] uppercase">
              Tattoo Studio
            </p>
          </div>
          <p className="font-['Playfair_Display'] italic text-[#E2C97E] mt-6 text-xl animate-[fadeIn_0.8s_ease_0.2s_both]">
            Sua arte começa aqui.
          </p>
          <div className="w-full max-w-md mx-auto mt-8 h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent animate-[fadeIn_1s_ease_0.4s_both]" />

          {/* Admin link */}
          <Link
            to="/admin"
            className="absolute top-4 right-4 text-gray-600 hover:text-gray-400 flex items-center gap-2 text-xs font-semibold tracking-wider transition-all duration-300 hover:scale-105"
          >
            <Settings size={14} /> ADMIN
          </Link>
        </header>

        {/* Form */}
        <section className="px-4 pb-24 flex justify-center">
          <div className="glass-card w-full max-w-2xl p-8 md:p-12 animate-[fadeIn_0.8s_ease_0.3s_both] border border-[#C9A84C]/40">
            <h1 className="font-['Playfair_Display'] text-white font-bold text-3xl md:text-4xl mb-2">
              Solicitar Orçamento
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-10">
              Preencha os dados abaixo e entraremos em contato via
              WhatsApp.
            </p>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-6"
            >
              {/* Nome */}
              <div className="animate-[fadeIn_0.6s_ease_0.4s_both]">
                <label style={labelStyle}>Nome completo *</label>
                <input
                  {...register("nome", {
                    required: "Nome é obrigatório",
                  })}
                  placeholder="Seu nome completo"
                  className="modern-input w-full"
                  onFocus={() => setFocused("nome")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("nome")}
                />
                {errors.nome && (
                  <span className="text-red-400 text-xs mt-2 block">
                    {errors.nome.message}
                  </span>
                )}
              </div>

              {/* WhatsApp */}
              <div className="animate-[fadeIn_0.6s_ease_0.5s_both]">
                <label style={labelStyle}>WhatsApp *</label>
                <input
                  value={phone}
                  onChange={handlePhoneChange}
                  onFocus={() => setFocused("whatsapp")}
                  onBlur={() => setFocused(null)}
                  placeholder="(11) 99999-9999"
                  type="tel"
                  className="modern-input w-full"
                  style={inputStyle("whatsapp")}
                />
                <input
                  type="hidden"
                  {...register("whatsapp", { required: true })}
                />
              </div>

              {/* Idade */}
              <div className="animate-[fadeIn_0.6s_ease_0.6s_both]">
                <label style={labelStyle}>Idade *</label>
                <input
                  {...register("idade", {
                    required: "Idade é obrigatória",
                  })}
                  type="number"
                  placeholder="Sua idade"
                  min="1"
                  max="120"
                  className="modern-input w-full"
                  onFocus={() => setFocused("idade")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("idade")}
                />
                {errors.idade && (
                  <span className="text-red-400 text-xs mt-2 block">
                    {errors.idade.message}
                  </span>
                )}
              </div>

              {/* ── BLOCO MENOR DE IDADE ── */}
              {isMinor && (
                <div className="bg-red-900/40 backdrop-blur-sm rounded-xl p-6 border border-red-700/50 animate-[fadeIn_0.4s_ease]">
                  <div className="flex items-start gap-3 mb-5">
                    <AlertTriangle
                      size={22}
                      className="text-red-300 flex-shrink-0 mt-1"
                    />
                    <p className="text-red-200 text-sm leading-relaxed">
                      <strong className="font-semibold">
                        Você é menor de idade.
                      </strong>{" "}
                      É necessária autorização dos responsáveis
                      para realizar a tatuagem.
                    </p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setMinorState(
                          minorState === "has-auth"
                            ? "none"
                            : "has-auth",
                        )
                      }
                      className="flex-1 min-w-[160px] py-3 px-4 rounded-lg font-semibold text-sm tracking-wide transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        background:
                          minorState === "has-auth"
                            ? "linear-gradient(135deg, #C9A84C, #B89840)"
                            : "transparent",
                        border: "1px solid #C9A84C",
                        color:
                          minorState === "has-auth"
                            ? "#1E1E1E"
                            : "#C9A84C",
                        boxShadow:
                          minorState === "has-auth"
                            ? "0 4px 12px rgba(201, 168, 76, 0.3)"
                            : "none",
                      }}
                    >
                      ✅ Já tenho a autorização
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Sou menor de idade e preciso do modelo de autorização para tatuagem.")}`,
                          "_blank",
                        )
                      }
                      className="flex-1 min-w-[160px] py-3 px-4 rounded-lg font-semibold text-sm tracking-wide transition-all duration-300 hover:scale-[1.02] border border-red-300 text-red-200 hover:bg-red-900/30"
                    >
                      📄 Preciso do modelo
                    </button>
                  </div>
                  {minorState === "has-auth" && (
                    <div className="mt-6 animate-[fadeIn_0.3s_ease]">
                      <label
                        style={{
                          ...labelStyle,
                          color: "#FFB3B3",
                        }}
                      >
                        Documento de autorização *
                      </label>
                      <div
                        onClick={() =>
                          authFileInputRef.current?.click()
                        }
                        className="border border-dashed border-[#C9A84C] rounded-xl p-4 cursor-pointer flex items-center gap-3 bg-[#C9A84C]/5 hover:bg-[#C9A84C]/10 transition-all duration-300 hover:border-[#C9A84C]/60"
                      >
                        <Upload
                          size={18}
                          className="text-[#C9A84C] flex-shrink-0"
                        />
                        <span className="text-gray-400 text-sm">
                          {authFile
                            ? authFile.name
                            : "Clique para selecionar o documento assinado (PDF, JPG, PNG)"}
                        </span>
                      </div>
                      <input
                        ref={authFileInputRef}
                        type="file"
                        onChange={handleAuthFileSelect}
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: "none" }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Descrição */}
              <div className="animate-[fadeIn_0.6s_ease_0.7s_both]">
                <label style={labelStyle}>
                  Descrição da tatuagem *
                </label>
                <textarea
                  {...register("descricao", {
                    required: "Descrição é obrigatória",
                  })}
                  rows={4}
                  placeholder="Descreva sua ideia, estilo, significado, tamanho aproximado..."
                  className="modern-input w-full resize-y min-h-[100px] font-['Inter']"
                  onFocus={() => setFocused("descricao")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("descricao")}
                />
                {errors.descricao && (
                  <span className="text-red-400 text-xs mt-2 block">
                    {errors.descricao.message}
                  </span>
                )}
              </div>

              {/* Tamanho */}
              <div className="animate-[fadeIn_0.6s_ease_0.8s_both]">
                <label style={labelStyle}>
                  Tamanho aproximado *
                </label>
                <select
                  {...register("tamanho", {
                    required: "Selecione um tamanho",
                  })}
                  className="modern-input w-full"
                  onFocus={() => setFocused("tamanho")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("tamanho")}
                >
                  <option
                    value=""
                    style={{ backgroundColor: "#2B2B2B" }}
                  >
                    Selecione o tamanho...
                  </option>
                  {[
                    "Muito pequena (até 3cm)",
                    "Pequena (3–5cm)",
                    "Média (5–10cm)",
                    "Grande (10–15cm)",
                    "Muito grande (acima de 15cm)",
                  ].map((t) => (
                    <option
                      key={t}
                      value={t}
                      style={{ backgroundColor: "#2B2B2B" }}
                    >
                      {t}
                    </option>
                  ))}
                </select>
                {errors.tamanho && (
                  <span className="text-red-400 text-xs mt-2 block">
                    {errors.tamanho.message}
                  </span>
                )}
              </div>

              {/* Localização */}
              <div className="animate-[fadeIn_0.6s_ease_0.9s_both]">
                <label style={labelStyle}>
                  Localização no corpo *
                </label>
                <select
                  {...register("localizacao", {
                    required: "Selecione a localização",
                  })}
                  className="modern-input w-full"
                  onFocus={() => setFocused("localizacao")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("localizacao")}
                >
                  <option
                    value=""
                    style={{ backgroundColor: "#2B2B2B" }}
                  >
                    Selecione a localização...
                  </option>
                  {[
                    "Braço",
                    "Perna",
                    "Costas",
                    "Peito",
                    "Pescoço",
                    "Mão",
                    "Pé",
                    "Costela",
                    "Outro",
                  ].map((loc) => (
                    <option
                      key={loc}
                      value={loc}
                      style={{ backgroundColor: "#2B2B2B" }}
                    >
                      {loc}
                    </option>
                  ))}
                </select>
                {errors.localizacao && (
                  <span className="text-red-400 text-xs mt-2 block">
                    {errors.localizacao.message}
                  </span>
                )}
                {/* Campo extra para "Outro" */}
                {localizacao === "Outro" && (
                  <div className="mt-3 animate-[fadeIn_0.3s_ease]">
                    <input
                      placeholder="Descreva a parte do corpo..."
                      className="modern-input w-full"
                      value={localizacaoOutro}
                      onChange={(e) => {
                        setLocalizacaoOutro(e.target.value);
                      }}
                      onFocus={() => setFocused("localizacaoOutro")}
                      onBlur={() => setFocused(null)}
                      style={inputStyle("localizacaoOutro")}
                    />
                  </div>
                )}

              </div>

              {/* Foto de referência Drag & Drop */}
              <div className="animate-[fadeIn_0.6s_ease_1s_both]">
                <label style={labelStyle}>
                  Foto de referência{" "}
                  <span style={{ color: "#4A4A4A", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>
                    (opcional)
                  </span>
                </label>

                {referenceFile ? (
                  <div style={{
                    border: "1px solid #3A3A3A",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    backgroundColor: "#1E1E1E",
                  }}>
                    <ImageIcon size={18} style={{ color: "#C9A84C", flexShrink: 0 }} />
                    <span style={{
                      color: "#A0A0A0",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "13px",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {referenceFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#C9A84C",
                        fontFamily: "Montserrat, sans-serif",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      Trocar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReferenceFile(null);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#4A4A4A",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragging ? "#E2C97E" : "#C9A84C"}`,
                      borderRadius: "8px",
                      padding: "40px 16px",
                      textAlign: "center",
                      cursor: "pointer",
                      backgroundColor: isDragging ? "rgba(201, 168, 76, 0.08)" : "rgba(201, 168, 76, 0.03)",
                      transition: "all 0.2s",
                    }}
                  >
                    <ImageIcon
                      size={36}
                      style={{ color: isDragging ? "#E2C97E" : "#C9A84C", margin: "0 auto 12px", display: "block" }}
                    />
                    <p style={{ color: "#A0A0A0", fontSize: "14px", margin: "0 0 6px", lineHeight: 1.6 }}>
                      Arraste sua referência aqui ou{" "}
                      <span style={{ color: "#C9A84C", textDecoration: "underline" }}>
                        clique para selecionar
                      </span>
                    </p>
                    <p style={{ color: "#4A4A4A", fontSize: "12px", margin: 0 }}>
                      PNG, JPG, JPEG até 10MB
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*"
                  style={{ display: "none" }}
                />
              </div>


              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-gold w-full py-4 text-base font-semibold tracking-wide"
                style={{
                  background: isSubmitting
                    ? "#4A4A4A"
                    : "linear-gradient(135deg, #C9A84C 0%, #E2C97E 100%)",
                  color: isSubmitting ? "#888" : "#1E1E1E",
                  borderRadius: "8px",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  opacity: isSubmitting ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (isSubmitting) return;
                  (e.target as HTMLButtonElement).style.background =
                    "linear-gradient(135deg, #E2C97E 0%, #C9A84C 100%)";
                  (e.target as HTMLButtonElement).style.boxShadow =
                    "0 0 24px rgba(201, 168, 76, 0.35)";
                }}
                onMouseLeave={(e) => {
                  if (isSubmitting) return;
                  (e.target as HTMLButtonElement).style.background =
                    "linear-gradient(135deg, #C9A84C 0%, #E2C97E 100%)";
                  (e.target as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                {isSubmitting ? "⏳ Enviando..." : "✉️ Enviar Solicitação via WhatsApp"}
              </button>
            </form>
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            backgroundColor: "#2B2B2B",
            padding: "12px 24px",
            textAlign: "center",
            borderTop: "1px solid #4A4A4A",
          }}
        >
          <h2 className="font-['Playfair_Display'] text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#E2C97E] to-[#C9A84C] tracking-wider mb-4">
            GABIINK
          </h2>
          <p
            style={{
              fontFamily: "Playfair Display, serif",
              fontStyle: "italic",
              color: "#E2C97E",
              fontSize: "16px",
              margin: "16px 0 24px",
            }}
          >
            Tatuagens fineline e delicadas, com higiene e cuidado em cada etapa.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "32px",
              marginBottom: "32px",
              flexWrap: "wrap",
            }}
          >
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#C9A84C",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
                fontFamily: "Montserrat, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "1px",
              }}
            >
              <Instagram size={20} /> @gabiink
            </a>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "#C9A84C",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
                fontFamily: "Montserrat, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "1px",
              }}
            >
              <MessageCircle size={20} /> WhatsApp
            </a>
          </div>
          <p
            style={{
              color: "#4A4A4A",
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              margin: 0,
            }}
          >
            © 2026 GabiInk Tattoo Studio. Todos os direitos
            reservados.
          </p>
        </footer>
      </div>
    </div>
  );
}

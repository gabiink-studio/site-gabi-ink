import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    Eye, MessageCircle, Trash2, X, Camera,
    CheckCircle2, Plus, Minus, ChevronRight,
    Users, CalendarCheck, Scissors, TrendingUp,
    ZoomIn, FileImage, Save, ChevronDown, UserPlus, RefreshCcw
} from 'lucide-react';
import { useStock, getCustoUso, getUnidadeUso } from '../../context/StockContext';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status = 'Pendente' | 'Agendado' | 'Em Atendimento' | 'Concluído' | 'Arquivado' | 'Lixeira';

export interface SessionMaterial {
    stockId: number;
    name: string;
    qty: number;        // quantidade em unidades de USO (ex: pares de luvas, ml de tinta)
    unitCost: number;  // custo por unidade de uso (snapshot no momento do registro)
    unit: string;      // unidade de uso (ex: 'par', 'ml', 'un')
    qtyPerPkg?: number;// quantas unidades de uso por pacote (para baixa proporcional no estoque)
}

interface Budget {
    firestoreId?: string;
    id: number;
    client: string;
    phone: string;
    age: number;
    tattoo: string;
    location: string;
    size: string;
    status: Status;
    value: number;
    date: string;
    scheduledAt: string;
    description: string;
    notes: string;
    sessionMaterials: SessionMaterial[];
    referenceImg?: string;
    anamneseUploaded: boolean;
    deleted?: boolean;
    anamneseUrl?: string;
    visualizada?: boolean;
}

const statusConfig: Record<Status, { bg: string; color: string; label: string }> = {
    Pendente: { bg: '#3A3A3A', color: '#A0A0A0', label: 'Pendente' },
    Agendado: { bg: '#1E3A5F', color: '#7EB8F7', label: 'Agendado' },
    'Em Atendimento': { bg: '#3D2E0E', color: '#C9A84C', label: 'Em Atend.' },
    Concluído: { bg: '#1A3D2B', color: '#5CC98A', label: 'Concluído' },
    Arquivado: { bg: '#252525', color: '#4A4A4A', label: 'Arquivado' },
    Lixeira: { bg: '#3D1A1A', color: '#E05252', label: 'Lixeira' },
};

const statusOrder: Status[] = ['Pendente', 'Agendado', 'Em Atendimento', 'Concluído', 'Arquivado'];

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Empty budget factory (for manual creation) ───────────────────────────────
function newEmptyBudget(): Budget {
    return {
        id: -1,
        firestoreId: undefined,
        client: '',
        phone: '',
        age: 0,
        tattoo: '',
        location: '',
        size: '',
        status: 'Pendente',
        value: 0,
        date: new Date().toISOString().split('T')[0],
        scheduledAt: '',
        description: '',
        notes: '',
        sessionMaterials: [],
        referenceImg: undefined,
        anamneseUploaded: false,
        deleted: false,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
    // Mapeamento de cores
    const statusStyles: Record<string, { bg: string; text: string }> = {
        'Pendente': { bg: '#FFFBEB', text: '#B45309' },
        'Em Andamento': { bg: '#EFF6FF', text: '#1D4ED8' },
        'Concluído': { bg: '#ECFDF5', text: '#047857' },
        'Cancelado': { bg: '#FEF2F2', text: '#991B1B' },
        // Adicione outros status que você usa aqui...
    };

    // A MÁGICA: Se o status for inválido ou não existir no objeto acima, 
    // ele usa o estilo cinza padrão embaixo, em vez de quebrar o site.
    const currentStyle = statusStyles[status] || { bg: '#F3F4F6', text: '#4B5563' };

    return (
        <span style={{
            backgroundColor: currentStyle.bg,
            color: currentStyle.text,
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'inline-block'
        }}>
            {status || 'Sem Status'}
        </span>
    );
};

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: '#A0A0A0', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 12px', borderBottom: '1px solid #2B2B2B', paddingBottom: '8px' }}>
            {children}
        </h3>
    );
}

function StatCard({ icon: Icon, label, value, color = '#C9A84C', subtitle }: {
    icon: React.ElementType; label: string; value: number; color?: string; subtitle?: string;
}) {
    return (
        <div style={{ backgroundColor: '#1E1E1E', borderRadius: '8px', padding: '20px', border: '1px solid #2B2B2B', borderLeft: `4px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 10px' }}>{label}</p>
                    <p style={{ color, fontFamily: 'Playfair Display, serif', fontSize: '40px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{value}</p>
                    {subtitle && <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '12px', margin: '6px 0 0' }}>{subtitle}</p>}
                </div>
                <div style={{ backgroundColor: `${color}18`, borderRadius: '10px', padding: '12px' }}>
                    <Icon size={22} style={{ color }} />
                </div>
            </div>
        </div>
    );
}

function ImageExpandModal({ src, onClose }: { src: string; onClose: () => void }) {
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', color: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
            </button>
            <img src={src} alt="Referência ampliada" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid #C9A84C40' }} />
        </div>
    );
}

// ─── Material Dropdown ────────────────────────────────────────────────────────
function MaterialDropdown({ onSelect, onClose }: {
    onSelect: (stockId: number) => void;
    onClose: () => void;
}) {
    const { stock } = useStock();
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const filtered = stock.filter(i =>
        i.unitCost > 0 && i.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, backgroundColor: '#1E1E1E', border: '1px solid #C9A84C', borderRadius: '8px', zIndex: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #2B2B2B' }}>
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar material..."
                    autoFocus
                    style={{ width: '100%', backgroundColor: '#2B2B2B', border: '1px solid #4A4A4A', borderRadius: '6px', color: '#F0F0F0', padding: '8px 12px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' as const }}
                />
            </div>
            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                    <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '13px', padding: '16px', textAlign: 'center', margin: 0 }}>Nenhum item encontrado</p>
                ) : filtered.map(item => (
                    <button key={item.id} onClick={() => { onSelect(item.id); onClose(); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #252525', cursor: 'pointer', transition: 'background-color 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(201,168,76,0.08)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ color: '#F0F0F0', fontFamily: 'Inter, sans-serif', fontSize: '13px', margin: 0 }}>{item.name}</p>
                            <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '11px', margin: '2px 0 0' }}>Estoque: {item.qty} {item.unit}</p>
                        </div>
                        <span style={{ color: '#C9A84C', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', fontWeight: 700, flexShrink: 0, marginLeft: '12px' }}>
                            R$ {fmt(item.unitCost)}/{item.unit}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Client Modal ─────────────────────────────────────────────────────────────
function ClientModal({ budget, onClose, onSave, onCreated }: {
    budget: Budget;
    onClose: () => void;
    onSave: (updated: Budget, deductMaterials: SessionMaterial[]) => void;
    onCreated?: (firestoreId: string) => void;
}) {
    const { stock } = useStock();

    // --- 1. ESTADOS LOCAIS ---
    const [adminFile, setAdminFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [anamneseFile, setAnamneseFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<Status>(budget.status);
    const [value, setValue] = useState(budget.value);
    const [scheduledAt, setScheduledAt] = useState(budget.scheduledAt);
    const [notes, setNotes] = useState(budget.notes);
    const [sessionMaterials, setSessionMaterials] = useState<SessionMaterial[]>(budget.sessionMaterials);
    const [anamneseUploaded, setAnamneseUploaded] = useState(budget.anamneseUploaded);
    const [expandImg, setExpandImg] = useState(false);
    const [showMaterialDD, setShowMaterialDD] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    // Estado para a imagem real (Resolve o erro realImageUrl)
    const [realImageUrl, setRealImageUrl] = useState<string | null>(null);

    // --- 2. CÁLCULOS (Resolve os erros de totalCost e margin) ---
    const totalCost = sessionMaterials.reduce((sum, m) => sum + m.qty * m.unitCost, 0);
    const margin = value - totalCost;

    // --- 3. EFEITO PARA BUSCAR IMAGEM ---
    useEffect(() => {
        const path = budget.referenceImg || (budget as any).fotoReferenciaURL;

        console.log('Caminho da imagem encontrado:', path);

        if (path && typeof path === 'string' && path.startsWith('referencias/')) {
            const storage = getStorage();
            const imageRef = ref(storage, path);
            getDownloadURL(imageRef)
                .then((url) => setRealImageUrl(url))
                .catch((err) => console.error('Erro ao carregar link da foto:', err));
        }
    }, [budget]);

    // --- 4. FUNÇÕES DE APOIO ---

    // ── Item 4: Auto status quando abre um Pendente ──
    const [statusPrompted, setStatusPrompted] = useState(false);
    useEffect(() => {
        if (!statusPrompted && budget.status === 'Pendente' && budget.id !== -1) {
            setStatusPrompted(true);
            const change = window.confirm(
                `O orçamento de "${budget.client}" está Pendente.\n\nDeseja movê-lo para "Em Atendimento" agora?`
            );
            if (change) setStatus('Em Atendimento');
        }
    }, []);

    const isNew = budget.id === -1;
    const [newName, setNewName] = useState(budget.client);
    const [newPhone, setNewPhone] = useState(budget.phone);
    const [newAge, setNewAge] = useState(budget.age || ('' as unknown as number));
    const [newDesc, setNewDesc] = useState(budget.description);
    const [newLocation, setNewLocation] = useState(budget.location);
    const [newSize, setNewSize] = useState(budget.size);
    const [saving, setSaving] = useState(false);

    const addMaterial = (stockId: number) => {
        const stockItem = stock.find(i => i.id === stockId);
        if (!stockItem) return;
        const custoUso = getCustoUso(stockItem);
        const unidadeUso = getUnidadeUso(stockItem);
        setSessionMaterials(prev => {
            const existing = prev.find(m => m.stockId === stockId);
            if (existing) {
                return prev.map(m => m.stockId === stockId ? { ...m, qty: m.qty + 1 } : m);
            }
            return [...prev, {
                stockId: stockItem.id,
                name: stockItem.name,
                qty: 1,
                unitCost: custoUso,
                unit: unidadeUso,
                qtyPerPkg: stockItem.qtdPorPacote,
            }];
        });
    };

    const updateQty = (stockId: number, delta: number) => {
        setSessionMaterials(prev =>
            prev.map(m => m.stockId === stockId ? { ...m, qty: Math.max(0, m.qty + delta) } : m)
                .filter(m => m.qty > 0)
        );
    };

    const setQtyDirect = (stockId: number, val: number) => {
        if (val <= 0) {
            setSessionMaterials(prev => prev.filter(m => m.stockId !== stockId));
        } else {
            setSessionMaterials(prev => prev.map(m => m.stockId === stockId ? { ...m, qty: val } : m));
        }
    };

    // ── Salvar: monta o objeto local + faz upload da anamnese + delega ao onSave ──
    const handleSave = async () => {
        if (isNew) {
            // ── CREATE: salva no Firestore ──
            setSaving(true);
            try {
                let fotoReferenciaURL = '';
                if (adminFile) {
                    const storage = getStorage();
                    const path = `referencias/${Date.now()}_${adminFile.name}`;
                    const storageRef = ref(storage, path);
                    await uploadBytes(storageRef, adminFile);
                    fotoReferenciaURL = path;
                }
                const docRef = await addDoc(collection(db, 'budgets'), {
                    nome: newName,
                    whatsapp: newPhone,
                    idade: Number(newAge) || 0,
                    descricao: newDesc,
                    localizacao: newLocation,
                    tamanho: newSize,
                    status: 'Pendente',
                    visualizada: true,
                    valor: value,
                    notes,
                    fotoReferenciaURL,
                    criadoEm: serverTimestamp(),
                });
                onCreated?.(docRef.id);
                onClose();
            } catch (err) {
                console.error('Erro ao criar orçamento:', err);
            } finally {
                setSaving(false);
            }
            return;
        }

        // ── UPDATE: monta o objeto e delega ao AdminDashboard ──
        setSaving(true);
        try {
            let resolvedAnamneseUrl: string | undefined = budget.anamneseUrl;
            let resolvedAnamneseUploaded = anamneseUploaded;

            // Upload da ficha antes de construir o objeto final
            if (anamneseFile) {
                const storage = getStorage();
                const fileName = `anamnese_${budget.firestoreId ?? Date.now()}_${Date.now()}`;
                const anamneseRef = ref(storage, `anamneses/${fileName}`);
                await uploadBytes(anamneseRef, anamneseFile);
                resolvedAnamneseUrl = await getDownloadURL(anamneseRef);
                resolvedAnamneseUploaded = true;
            }

            const updated: Budget = {
                ...budget,
                status,
                value,
                scheduledAt,
                notes,
                sessionMaterials,
                anamneseUploaded: resolvedAnamneseUploaded,
                anamneseUrl: resolvedAnamneseUrl,
            };

            onSave(updated, status === 'Em Atendimento' ? sessionMaterials : []);
            setSavedSuccess(true);
            setTimeout(() => { setSavedSuccess(false); setAnamneseFile(null); }, 1200);
        } catch (err) {
            console.error('Erro ao preparar save:', err);
            alert('Erro ao preparar o salvamento.');
        } finally {
            setSaving(false);
        }
    };

    const isReadonly = status === 'Concluído';

    const inpStyle: React.CSSProperties = {
        width: '100%',
        backgroundColor: '#2B2B2B',
        border: '1px solid #4A4A4A',
        borderRadius: '6px',
        color: '#F0F0F0',
        padding: '10px 14px',
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif',
        outline: 'none',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.2s',
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 150 }} />

            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(500px, 100vw)', backgroundColor: '#1E1E1E', zIndex: 151, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,0.6)', borderLeft: '1px solid #C9A84C30', animation: 'slideIn 0.3s cubic-bezier(0.4,0,0.2,1)' }}>

                {/* ── Fixed Header ── */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #2B2B2B', flexShrink: 0, backgroundColor: '#1E1E1E' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div>
                            <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#F0F0F0', fontSize: '19px', fontWeight: 700, margin: '0 0 2px' }}>
                                {isNew ? '+ Novo Orçamento' : budget.client}
                            </h2>
                            {isNew ? (
                                <p style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif', fontSize: '12px', margin: 0 }}>Cadastro manual via WhatsApp / atendimento presencial</p>
                            ) : (
                                <p style={{ color: '#C9A84C', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' as const, margin: 0 }}>
                                    {budget.tattoo} · {budget.location}
                                </p>
                            )}
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A0A0A0', padding: '4px', flexShrink: 0 }}><X size={20} /></button>
                    </div>

                    {/* Status Pills (hidden in creation mode) */}
                    {!isNew && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                            {statusOrder.map((s, i) => {
                                const active = status === s;
                                const cfg = statusConfig[s];
                                return (
                                    <React.Fragment key={s}>
                                        <button onClick={() => setStatus(s)}
                                            style={{ padding: '6px 14px', border: `1px solid ${active ? cfg.color : '#4A4A4A'}`, borderRadius: '20px', background: active ? cfg.color : '#2B2B2B', color: active ? '#1E1E1E' : '#A0A0A0', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '11px', cursor: 'pointer', letterSpacing: '0.3px', transition: 'all 0.2s', whiteSpace: 'nowrap' as const }}>
                                            {s}
                                        </button>
                                        {i < statusOrder.length - 1 && <ChevronRight size={12} style={{ color: '#4A4A4A', flexShrink: 0, alignSelf: 'center' }} />}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Scrollable Body ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                    {/* ── MODO CRIAÇÃO: formulário simples ── */}
                    {isNew && (
                        <section style={{ marginBottom: '24px' }}>
                            <SectionTitle>Dados do Cliente</SectionTitle>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {([
                                    { lbl: 'Nome *', val: newName, set: setNewName, placeholder: 'Nome completo' },
                                    { lbl: 'WhatsApp *', val: newPhone, set: setNewPhone, placeholder: '(XX) XXXXX-XXXX' },
                                ] as const).map(({ lbl, val, set, placeholder }) => (
                                    <div key={lbl}>
                                        <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>{lbl}</p>
                                        <input value={val} onChange={e => (set as (v: string) => void)(e.target.value)} placeholder={placeholder}
                                            style={{ ...inpStyle }}
                                            onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                            onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                                    </div>
                                ))}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Idade</p>
                                        <input type="number" value={newAge as number} onChange={e => setNewAge(Number(e.target.value))} placeholder="0"
                                            style={{ ...inpStyle }}
                                            onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                            onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                                    </div>
                                    <div>
                                        <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Valor (R$)</p>
                                        <input type="number" value={value || ''} onChange={e => setValue(Number(e.target.value))} placeholder="0,00"
                                            style={{ ...inpStyle }}
                                            onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                            onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Localização</p>
                                        <input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Braço, costas..."
                                            style={{ ...inpStyle }}
                                            onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                            onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                                    </div>
                                    <div>
                                        <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Tamanho</p>
                                        <input value={newSize} onChange={e => setNewSize(e.target.value)} placeholder="P, M, G..."
                                            style={{ ...inpStyle }}
                                            onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                            onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                                    </div>
                                </div>
                                <div>
                                    <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Descrição da Tatuagem</p>
                                    <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} placeholder="Descreva o pedido..."
                                        style={{ ...inpStyle, resize: 'vertical' as const, lineHeight: 1.6 }}
                                        onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                        onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                                </div>
                                {/* ── Upload de Imagem de Referência ── */}
                                <div>
                                    <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Imagem de Referência</p>
                                    <label style={{ display: 'block', cursor: 'pointer' }}>
                                        <input type="file" accept="image/*" style={{ display: 'none' }}
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setAdminFile(file);
                                                    setPreviewUrl(URL.createObjectURL(file));
                                                }
                                            }} />
                                        {previewUrl ? (
                                            <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #C9A84C' }}>
                                                <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', padding: '6px', textAlign: 'center' as const }}>
                                                    <span style={{ color: '#E2C97E', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', fontWeight: 700 }}>Clique para trocar</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ backgroundColor: '#2B2B2B', borderRadius: '8px', border: '1px dashed #4A4A4A', padding: '24px', textAlign: 'center' as const, transition: 'border-color 0.2s' }}
                                                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#C9A84C'}
                                                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#4A4A4A'}>
                                                <Camera size={24} style={{ color: '#4A4A4A', margin: '0 auto 6px', display: 'block' }} />
                                                <span style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>Clique para adicionar foto</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                                <div>
                                    <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Notas Internas</p>
                                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Veio pelo WhatsApp, indicação..."
                                        style={{ ...inpStyle, resize: 'vertical' as const, lineHeight: 1.6 }}
                                        onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                        onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ── MODO EDIÇÃO: dados read-only do cliente ── */}
                    {!isNew && (
                        <section style={{ marginBottom: '24px' }}>
                            <SectionTitle>Dados do Cliente</SectionTitle>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                    { lbl: 'Nome', val: budget.client },
                                    { lbl: 'Telefone', val: budget.phone },
                                    { lbl: 'Idade', val: `${budget.age} anos` },
                                    { lbl: 'Data Sol.', val: new Date(budget.date).toLocaleDateString('pt-BR') },
                                ].map(({ lbl, val }) => (
                                    <div key={lbl}>
                                        <p style={{ color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const, margin: '0 0 2px' }}>{lbl}</p>
                                        <p style={{ color: '#F0F0F0', fontFamily: 'Inter, sans-serif', fontSize: '14px', margin: 0 }}>{val}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── STATUS sections (only for existing budgets) ── */}
                    {!isNew && (<>
                        {/* Referência */}
                        <section style={{ marginBottom: '24px' }}>
                            <SectionTitle>Imagem de Referência</SectionTitle>
                            {budget.referenceImg ? (
                                <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #2B2B2B', cursor: 'pointer' }} onClick={() => setExpandImg(true)}>
                                    <img src={realImageUrl || budget.referenceImg} alt="Referência" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0)', transition: 'background-color 0.2s' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(0,0,0,0.4)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(0,0,0,0)'}>
                                        <div style={{ backgroundColor: 'rgba(201,168,76,0.9)', borderRadius: '8px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <ZoomIn size={14} style={{ color: '#1E1E1E' }} />
                                            <span style={{ color: '#1E1E1E', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', fontWeight: 700 }}>Ampliar</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ backgroundColor: '#2B2B2B', borderRadius: '8px', border: '1px dashed #4A4A4A', padding: '28px', textAlign: 'center' }}>
                                    <FileImage size={28} style={{ color: '#4A4A4A', margin: '0 auto 8px', display: 'block' }} />
                                    <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '13px', margin: 0 }}>Sem imagem de referência</p>
                                </div>
                            )}
                        </section>

                        {/* Descrição (readonly) */}
                        <section style={{ marginBottom: '24px' }}>
                            <SectionTitle>Descrição da Tatuagem</SectionTitle>
                            <div style={{ backgroundColor: '#2B2B2B', borderRadius: '6px', padding: '12px 14px', border: '1px solid #3A3A3A' }}>
                                <p style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>{budget.description}</p>
                            </div>
                        </section>

                        {/* Valor (editável) */}
                        <section style={{ marginBottom: '24px' }}>
                            <SectionTitle>Valor do Orçamento</SectionTitle>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#C9A84C', fontFamily: 'Montserrat, sans-serif', fontSize: '14px', fontWeight: 700 }}>R$</span>
                                <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} step="0.01" min="0"
                                    style={{ ...inpStyle, paddingLeft: '36px' }}
                                    onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                    onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                            </div>
                        </section>
                    </>
                    )}

                    {/* ── STATUS: AGENDADO ── */}
                    {!isNew && status === 'Agendado' && (
                        <>
                            {/* Valor (readonly) */}
                            <section style={{ marginBottom: '24px' }}>
                                <SectionTitle>Valor Combinado</SectionTitle>
                                <p style={{ color: '#C9A84C', fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: 700, margin: 0 }}>
                                    R$ {fmt(value)}
                                </p>
                            </section>

                            {/* Data e horário */}
                            <section style={{ marginBottom: '24px' }}>
                                <SectionTitle>Data e Horário da Sessão</SectionTitle>
                                <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                                    style={{ ...inpStyle, colorScheme: 'dark' }}
                                    onFocus={e => { e.target.style.borderColor = '#C9A84C'; }}
                                    onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }} />
                                {scheduledAt && (
                                    <p style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif', fontSize: '13px', marginTop: '8px', marginBottom: 0 }}>
                                        📅 {new Date(scheduledAt).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </section>
                        </>
                    )}

                    {/* ── STATUS: EM ATENDIMENTO ── */}
                    {!isNew && status === 'Em Atendimento' && (
                        <>
                            {/* Valor */}
                            <section style={{ marginBottom: '24px' }}>
                                <SectionTitle>Valor Confirmado</SectionTitle>
                                <p style={{ color: '#C9A84C', fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: 700, margin: 0 }}>R$ {fmt(value)}</p>
                            </section>

                            {/* Anamnese */}
                            <section style={{ marginBottom: '24px' }}>
                                <SectionTitle>Ficha de Anamnese</SectionTitle>

                                {/* Input escondido que realmente abre a câmera/galeria */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*,application/pdf"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setAnamneseFile(e.target.files[0]);
                                            setAnamneseUploaded(true); // Aqui ele mostra o verde após selecionar
                                        }
                                    }}
                                />

                                {anamneseUploaded ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', backgroundColor: 'rgba(92,201,138,0.08)', border: '1px solid #5CC98A40', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <CheckCircle2 size={18} style={{ color: '#5CC98A' }} />
                                            <span style={{ color: '#5CC98A', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
                                                {anamneseFile ? anamneseFile.name : "Ficha registrada"}
                                            </span>
                                        </div>
                                        {/* Botão para cancelar se escolher errado */}
                                        <X size={14} style={{ cursor: 'pointer', color: '#5CC98A' }} onClick={() => { setAnamneseUploaded(false); setAnamneseFile(null); }} />
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()} // Simula o clique no input escondido
                                        style={{ width: '100%', padding: '14px', background: 'rgba(201,168,76,0.05)', border: '1px dashed #C9A84C', borderRadius: '8px', color: '#C9A84C', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.5px', transition: 'all 0.2s' }}
                                    >
                                        <Camera size={18} />
                                        Fotografar / Enviar Ficha
                                    </button>
                                )}
                            </section>

                            {/* ── Checklist de Materiais ── */}
                            <section style={{ marginBottom: '24px' }}>
                                <SectionTitle>Checklist de Materiais</SectionTitle>

                                {/* Material rows */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                    {sessionMaterials.map(mat => {
                                        const subtotal = mat.qty * mat.unitCost;
                                        return (
                                            <div key={mat.stockId} style={{ display: 'grid', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: '#2B2B2B', borderRadius: '6px', gridTemplateColumns: '1fr auto auto auto auto' }}>
                                                {/* Nome */}
                                                <p style={{ color: '#F0F0F0', fontFamily: 'Inter, sans-serif', fontSize: '13px', margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.name}</p>

                                                {/* – botão */}
                                                <button onClick={() => updateQty(mat.stockId, -1)}
                                                    style={{ background: 'none', border: '1px solid #4A4A4A', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', color: '#A0A0A0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E05252'; (e.currentTarget as HTMLButtonElement).style.color = '#E05252'; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#4A4A4A'; (e.currentTarget as HTMLButtonElement).style.color = '#A0A0A0'; }}>
                                                    <Minus size={11} />
                                                </button>

                                                {/* Qty input */}
                                                <input type="number" value={mat.qty} min="1"
                                                    onChange={e => setQtyDirect(mat.stockId, Number(e.target.value))}
                                                    style={{ width: '44px', backgroundColor: '#1E1E1E', border: '1px solid #4A4A4A', borderRadius: '4px', color: '#C9A84C', textAlign: 'center' as const, padding: '3px 4px', fontSize: '14px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, outline: 'none' }} />

                                                {/* + botão */}
                                                <button onClick={() => updateQty(mat.stockId, 1)}
                                                    style={{ background: 'none', border: '1px solid #4A4A4A', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', color: '#A0A0A0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#C9A84C'; (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C'; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#4A4A4A'; (e.currentTarget as HTMLButtonElement).style.color = '#A0A0A0'; }}>
                                                    <Plus size={11} />
                                                </button>

                                                {/* Custo unitário × subtotal */}
                                                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                                                    <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '10px', margin: '0 0 1px' }}>× R$ {fmt(mat.unitCost)}</p>
                                                    <p style={{ color: '#E2C97E', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', fontWeight: 700, margin: 0 }}>R$ {fmt(subtotal)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* + Adicionar Material */}
                                <div style={{ position: 'relative' }}>
                                    <button onClick={() => setShowMaterialDD(v => !v)}
                                        style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: '1px dashed #C9A84C', borderRadius: '8px', color: '#C9A84C', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.5px', transition: 'all 0.2s' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,168,76,0.06)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                                        <Plus size={15} />
                                        Adicionar Material
                                        <ChevronDown size={13} style={{ marginLeft: 'auto', opacity: 0.7, transform: showMaterialDD ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                    </button>

                                    {showMaterialDD && (
                                        <MaterialDropdown
                                            onSelect={addMaterial}
                                            onClose={() => setShowMaterialDD(false)}
                                        />
                                    )}
                                </div>

                                {/* Resumo financeiro */}
                                <div style={{ marginTop: '14px', backgroundColor: '#2B2B2B', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #C9A84C' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' as const }}>Custo total dos materiais:</span>
                                        <span style={{ color: '#E2C97E', fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: 700 }}>R$ {fmt(totalCost)}</span>
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {/* ── STATUS: CONCLUÍDO (readonly) ── */}
                    {!isNew && status === 'Concluído' && (
                        <>
                            {/* Referência */}
                            {budget.referenceImg && (
                                <section style={{ marginBottom: '24px' }}>
                                    <SectionTitle>Imagem de Referência</SectionTitle>
                                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #2B2B2B', cursor: 'pointer' }} onClick={() => setExpandImg(true)}>
                                        <img src={realImageUrl || budget.referenceImg} alt="Referência" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                                        <div style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(201,168,76,0.9)', borderRadius: '6px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <ZoomIn size={12} style={{ color: '#1E1E1E' }} />
                                            <span style={{ color: '#1E1E1E', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 700 }}>Ampliar</span>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Anamnese (view only) */}
                            <section style={{ marginBottom: '24px' }}>
                                <SectionTitle>Ficha de Anamnese</SectionTitle>
                                {budget.anamneseUploaded && budget.anamneseUrl ? (
                                    <button
                                        onClick={() => window.open(budget.anamneseUrl, '_blank', 'noopener,noreferrer')}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid #4A4A4A',
                                            borderRadius: '8px',
                                            color: '#E0E0E0', // Deixei um pouco mais claro para parecer clicável
                                            fontFamily: 'Montserrat, sans-serif',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#4A4A4A')}
                                    >
                                        <FileImage size={16} />
                                        Visualizar Ficha
                                    </button>
                                ) : (
                                    <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>
                                        Ficha não registrada.
                                    </p>
                                )}
                            </section>

                            {/* Materiais utilizados */}
                            {sessionMaterials.length > 0 && (
                                <section style={{ marginBottom: '24px' }}>
                                    <SectionTitle>Materiais Utilizados</SectionTitle>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {sessionMaterials.map(mat => (
                                            <div key={mat.stockId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#2B2B2B', borderRadius: '6px' }}>
                                                <div>
                                                    <p style={{ color: '#F0F0F0', fontFamily: 'Inter, sans-serif', fontSize: '13px', margin: 0 }}>{mat.name}</p>
                                                    <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '11px', margin: '1px 0 0' }}>{mat.qty} {mat.unit} × R$ {fmt(mat.unitCost)}</p>
                                                </div>
                                                <span style={{ color: '#E2C97E', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', fontWeight: 700 }}>R$ {fmt(mat.qty * mat.unitCost)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Resumo financeiro completo */}
                            <section style={{ marginBottom: '24px' }}>
                                <SectionTitle>Resumo Financeiro</SectionTitle>
                                <div style={{ backgroundColor: '#2B2B2B', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #C9A84C', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Custo total dos materiais:</span>
                                        <span style={{ color: '#E2C97E', fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700 }}>R$ {fmt(totalCost)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Valor cobrado:</span>
                                        <span style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700 }}>R$ {fmt(value)}</span>
                                    </div>
                                    <div style={{ borderTop: '1px solid #3A3A3A', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#F0F0F0', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>Margem da sessão:</span>
                                        <span style={{ color: margin >= 0 ? '#4CAF50' : '#E05252', fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700 }}>
                                            {margin >= 0 ? '+' : ''}R$ {fmt(margin)}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        </>
                    )}

                    {/* ── Notas internas (todos os status exceto concluído onde é readonly) ── */}
                    <section style={{ marginBottom: isReadonly ? '24px' : '80px' }}>
                        <SectionTitle>Notas Internas</SectionTitle>
                        <textarea
                            value={notes}
                            onChange={e => !isReadonly && setNotes(e.target.value)}
                            readOnly={isReadonly}
                            rows={4}
                            placeholder="Anotações internas, observações... (somente você vê)"
                            style={{ ...inpStyle, resize: 'vertical', minHeight: '90px', lineHeight: 1.6, opacity: isReadonly ? 0.6 : 1, cursor: isReadonly ? 'default' : 'text' }}
                            onFocus={e => { if (!isReadonly) e.target.style.borderColor = '#C9A84C'; }}
                            onBlur={e => { e.target.style.borderColor = '#4A4A4A'; }}
                        />
                    </section>
                </div>

                {/* ── Fixed Footer: Save button (sempre visível no modo criação; visível em qualquer status no modo edição) ── */}
                {(true) && (
                    <div style={{ padding: '14px 20px', borderTop: '1px solid #2B2B2B', backgroundColor: '#1E1E1E', flexShrink: 0 }}>
                        <button onClick={handleSave} disabled={saving}
                            style={{ width: '100%', height: '48px', background: saving ? '#4A4A4A' : (savedSuccess ? 'linear-gradient(135deg, #5CC98A, #4CAF50)' : 'linear-gradient(135deg, #C9A84C, #E2C97E)'), color: saving ? '#F0F0F0' : '#1E1E1E', border: 'none', borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '15px', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.5px', transition: 'all 0.3s' }}
                            onMouseEnter={e => { if (!savedSuccess && !saving) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(201,168,76,0.4)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}>
                            {saving ? 'Salvando...' : savedSuccess ? <><CheckCircle2 size={18} /> Salvo com sucesso!</> : isNew ? <><UserPlus size={17} /> Cadastrar Cliente</> : <><Save size={17} /> Salvar</>}
                        </button>
                    </div>
                )}
            </div>

            {expandImg && budget.referenceImg && (
                <ImageExpandModal src={realImageUrl || budget.referenceImg} onClose={() => setExpandImg(false)} />
            )}
        </>
    );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function AdminDashboard() {
    const [searchParams] = useSearchParams();
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'budgets'), orderBy('criadoEm', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Budget[] = snapshot.docs.map((doc, index) => {
                const d = doc.data();
                const rawStatus = d.status ?? 'pendente';
                const STATUS_MAP: Record<string, Status> = {
                    'pendente': 'Pendente',
                    'agendado': 'Agendado',
                    'em atendimento': 'Em Atendimento',
                    'concluido': 'Concluído',
                    'concluído': 'Concluído',
                    'arquivado': 'Arquivado',
                    'lixeira': 'Lixeira',
                };
                const status: Status = STATUS_MAP[rawStatus.toLowerCase().trim()] ?? 'Pendente';
                return {
                    id: index + 1,
                    firestoreId: doc.id,
                    client: d.nome ?? '',
                    phone: d.whatsapp ?? '',
                    age: Number(d.idade) ?? 0,
                    tattoo: d.descricao?.substring(0, 40) ?? 'Sem descrição',
                    location: d.localizacao ?? '',
                    size: d.tamanho ?? '',
                    description: d.descricao ?? '',
                    status,
                    value: d.valor ?? 0,
                    date: d.criadoEm?.toDate().toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
                    scheduledAt: '',
                    notes: d.notes ?? '',
                    referenceImg: d.fotoReferenciaURL ?? undefined,
                    anamneseUploaded: d.anamneseUploaded === true,
                    anamneseUrl: d.anamneseUrl ?? undefined,
                    sessionMaterials: (d.sessionMaterials ?? []).map((m: SessionMaterial) => ({
                        ...m,
                        qty: parseFloat(Number(m.qty).toFixed(2)),
                    })),
                    deleted: d.deleted === true,
                    visualizada: d.visualizada === true,

                };
            });
            setBudgets(data);
            setLoading(false);
        }, (error) => {
            // Silencia o erro esperado de logout — o listener fecha sozinho
            if (error.code === 'permission-denied') {
                unsubscribe();
                return;
            }
            console.error('Erro no listener de orçamentos:', error);
        });
        return () => unsubscribe();
    }, []);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [newBudget, setNewBudget] = useState<Budget | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const { deductItems } = useStock();
    // ── Sistema de Notificações ──
    const prevBudgetsRef = React.useRef<Budget[]>([]);

    const playNotificationSound = React.useCallback(() => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.4);
        } catch (e) { /* sem áudio disponível */ }
    }, []);

    React.useEffect(() => {
        const prev = prevBudgetsRef.current;
        if (prev.length === 0) {
            prevBudgetsRef.current = budgets;
            return;
        }
        const prevIds = new Set(prev.map(b => b.firestoreId));
        const novos = budgets.filter(b => !prevIds.has(b.firestoreId) && !b.deleted);
        if (novos.length > 0) {
            playNotificationSound();
            novos.forEach(b => {
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('💬 Novo Orçamento — GabiInk', {
                        body: `${b.client} solicitou um orçamento!`,
                        icon: '/favicon.ico',
                        tag: b.firestoreId,
                    });
                }
            });
        }
        prevBudgetsRef.current = budgets;
    }, [budgets, playNotificationSound]);

    const filter = searchParams.get('filter');
    const highlightId = searchParams.get('highlight');

    // Mark a budget as read in Firestore
    const markAsRead = async (firestoreId?: string) => {
        if (!firestoreId) return;
        try {
            await updateDoc(doc(db, 'budgets', firestoreId), { visualizada: true });
        } catch (err) {
            console.error('Erro ao marcar como lida:', err);
        }
    };

    // Auto-open ClientModal when navigated from notification bell
    useEffect(() => {
        if (highlightId && budgets.length > 0) {
            const target = budgets.find(b => b.firestoreId === highlightId);
            if (target) {
                setSelectedBudget(target);
                markAsRead(target.firestoreId);
            }
        }
    }, [highlightId, budgets]);

    const getFiltered = () => {
        // Se for lixeira, mostra só os deletados
        if (filter === 'lixeira') return budgets.filter(b => b.deleted === true);

        // Para qualquer outra aba, filtra para NÃO mostrar os deletados
        const active = budgets.filter(b => !b.deleted);

        if (filter === 'agendados') return active.filter(b => b.status === 'Agendado');
        if (filter === 'em-atendimento') return active.filter(b => b.status === 'Em Atendimento');
        if (filter === 'concluidos') return active.filter(b => b.status === 'Concluído');
        if (filter === 'arquivados') return active.filter(b => b.status === 'Arquivado');

        return active; // Aba principal mostra todos os não-deletados
    };
    const naoLidas = budgets.filter(b => !b.visualizada && !b.deleted).length;
    const filtered = getFiltered();

    const pageTitle = filter
        ? ({ agendados: 'Agendados', 'em-atendimento': 'Em Atendimento', concluidos: 'Concluídos', arquivados: 'Arquivados', lixeira: 'Lixeira' } as Record<string, string>)[filter] ?? 'Orçamentos'
        : 'Orçamentos';

    // ── onSave recebido do ClientModal: persiste no Firestore e atualiza estado local ──
    const handleSave = async (updated: Budget, materialsToDeduct: SessionMaterial[]) => {
        if (!updated.firestoreId) return;
        try {
            const dataToUpdate: Record<string, unknown> = {
                status: updated.status,           // Preserva casing exato (ex: 'Concluído')
                value: updated.value,
                notes: updated.notes,
                scheduledAt: updated.scheduledAt ?? null,
                anamneseUploaded: updated.anamneseUploaded ?? false,
                ...(updated.anamneseUrl ? { anamneseUrl: updated.anamneseUrl } : {}),
                ssessionMaterials: updated.sessionMaterials.map(m => ({
                    stockId: m.stockId,
                    name: m.name,
                    qty: m.qty,
                    unitCost: m.unitCost,
                    unit: m.unit,
                    ...(m.qtyPerPkg !== undefined ? { qtyPerPkg: m.qtyPerPkg } : {}),
                })),
            };
            await updateDoc(doc(db, 'budgets', updated.firestoreId), dataToUpdate);

            // Atualiza lista local (o onSnapshot fará o mesmo via Firestore, mas isso garante UI imediata)
            setBudgets((prev: Budget[]) => prev.map((b: Budget) => b.firestoreId === updated.firestoreId ? updated : b));
            setSelectedBudget(updated);

            if (materialsToDeduct.length > 0) {
                deductItems(materialsToDeduct.map(m => {
                    // Primeiro calculamos o valor bruto
                    const rawQty = m.qtyPerPkg && m.qtyPerPkg > 0
                        ? m.qty / m.qtyPerPkg
                        : m.qty;

                    return {
                        id: m.stockId,
                        // 🟢 A MUDANÇA É AQUI: 
                        // .toFixed(4) corta as casas decimais extras
                        // Number() remove os zeros inúteis do final (ex: 0.0400 vira 0.04)
                        qty: parseFloat(rawQty.toFixed(2)),
                    };
                }));
            }
        } catch (err) {
            console.error('Erro ao persistir no Firestore:', err);
            alert('Não foi possível salvar. Tente novamente.');
        }
    };

    // ── Soft delete: move para a lixeira no Firestore ──
    const handleDelete = async (budget: Budget) => {
        if (!budget.firestoreId) return;

        // ✅ Atualização otimista — remove da tela imediatamente
        setBudgets(prev => prev.map(b =>
            b.firestoreId === budget.firestoreId ? { ...b, deleted: true } : b
        ));
        if (selectedBudget?.firestoreId === budget.firestoreId) setSelectedBudget(null);

        try {
            await updateDoc(doc(db, 'budgets', budget.firestoreId), { deleted: true });
        } catch (err) {
            // Reverte visualmente se o banco falhar
            setBudgets(prev => prev.map(b =>
                b.firestoreId === budget.firestoreId ? { ...b, deleted: false } : b
            ));
            console.error('Erro ao deletar:', err);
        }
    };

    // ── Restaurar da lixeira no Firestore ──
    const handleRestore = async (budget: Budget) => {
        if (!budget.firestoreId) return;
        try {
            await updateDoc(doc(db, 'budgets', budget.firestoreId), { deleted: false, status: 'Pendente' });
        } catch (err) {
            console.error('Erro ao restaurar orçamento:', err);
        }
    };

    // ── Excluir permanentemente do Firestore ──
    const handlePermanentDelete = async (budget: Budget) => {
        if (!budget.firestoreId) return;
        const confirm = window.confirm(`Excluir "${budget.client}" permanentemente? Esta ação não pode ser desfeita.`);
        if (!confirm) return;
        try {
            await deleteDoc(doc(db, 'budgets', budget.firestoreId));
        } catch (err) {
            console.error('Erro ao excluir permanentemente:', err);
        }
    };

    const stats = {
        novos: budgets.filter(b => b.status === 'Pendente' && !b.deleted).length,
        agendados: budgets.filter(b => b.status === 'Agendado' && !b.deleted).length,
        emAtendimento: budgets.filter(b => b.status === 'Em Atendimento' && !b.deleted).length,
        concluidos: budgets.filter(b => b.status === 'Concluído' && !b.deleted).length,
    };

    const actionBtn = (title: string, icon: React.ReactNode, onClick: () => void, hoverColor = '#C9A84C') => (
        <button onClick={onClick} title={title}
            style={{ background: 'none', border: '1px solid #2B2B2B', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', color: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = hoverColor; (e.currentTarget as HTMLButtonElement).style.color = hoverColor; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2B2B2B'; (e.currentTarget as HTMLButtonElement).style.color = '#4A4A4A'; }}>
            {icon}
        </button>
    );

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: '#C9A84C', fontFamily: 'Montserrat, sans-serif' }}>
                Carregando orçamentos...
            </div>
        );
    }
    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>

            {/* Stat Cards */}
            {!filter && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '28px' }}>
                    <StatCard icon={Users} label="Novos Orçamentos" value={stats.novos} color="#A0A0A0" subtitle="Aguardando resposta" />
                    <StatCard icon={CalendarCheck} label="Agendamentos" value={stats.agendados} color="#7EB8F7" subtitle="Esta semana" />
                    <StatCard icon={Scissors} label="Em Atendimento" value={stats.emAtendimento} color="#C9A84C" subtitle="Sessões abertas" />
                    <StatCard icon={TrendingUp} label="Concluídos" value={stats.concluidos} color="#5CC98A" subtitle="Este mês" />
                </div>
            )}

            {/* Table header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <h2 style={{
                            fontFamily: 'Playfair Display, serif', color: '#F0F0F0', fontSize: '18px',
                            lineHeight: 1.1, fontWeight: 700, margin: 0
                        }}>{pageTitle}</h2>
                        {naoLidas > 0 && (
                            <span style={{ backgroundColor: '#E05252', color: '#fff', borderRadius: '9999px', padding: '2px 8px', fontSize: '11px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, lineHeight: 1.4 }}>
                                {naoLidas} {naoLidas === 1 ? 'novo' : 'novos'}
                            </span>
                        )}
                        {'Notification' in window && Notification.permission === 'default' && (
                            <button
                                onClick={async () => {
                                    const result = await Notification.requestPermission();
                                    if (result === 'granted') {
                                        new Notification('GabiInk 🔔', {
                                            body: 'Alertas ativados! Você será avisada de novos orçamentos.',
                                            icon: '/favicon.ico',
                                        });
                                    }
                                }}
                                title="Ativar notificações no navegador"
                                style={{
                                    borderRadius: '7px',
                                    border: '1px solid #C9A84C',
                                    padding: '6px 12px',
                                    minHeight: '36px',         // ← toque confortável no mobile
                                    color: '#C9A84C',
                                    fontFamily: 'Montserrat, sans-serif',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    letterSpacing: '0.3px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    WebkitTapHighlightColor: 'transparent', // ← remove flash azul no iOS
                                }}
                            >
                                Ativar alertas
                            </button>
                        )}
                    </div>
                    <p style={{ color: '#5C5C5C', fontFamily: 'Inter, sans-serif', fontSize: '12px', margin: '4px 0 0' }}>
                        {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'} encontrados
                    </p>
                </div>
                <button
                    onClick={() => setNewBudget(newEmptyBudget())}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#1E1E1E', border: 'none', borderRadius: '8px', padding: '10px 18px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(201,168,76,0.35)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                >
                    <UserPlus size={15} /> Novo Orçamento
                </button>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: '#1E1E1E', borderRadius: '8px', border: '1px solid #2B2B2B', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#252525' }}>
                                {['Cliente', 'Tatuagem', 'Status', 'Valor', 'Data', 'Ações'].map(col => (
                                    <th key={col} style={{ padding: '12px 16px', textAlign: 'left', color: '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '64px 24px', textAlign: 'center', color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '15px' }}>
                                        Nenhum registro nesta seção.
                                    </td>
                                </tr>
                            ) : filtered.map((budget, index) => (
                                <tr key={budget.id}
                                    style={{ borderTop: index > 0 ? '1px solid #252525' : 'none', transition: 'background-color 0.15s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(201,168,76,0.03)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ''; }}>

                                    {/* Cliente */}
                                    <td style={{ padding: '14px 16px' }}>
                                        <p style={{ color: '#F0F0F0', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, margin: 0 }}>{budget.client}</p>
                                        <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '12px', margin: '1px 0 0' }}>{budget.phone}</p>
                                    </td>

                                    {/* Tatuagem */}
                                    <td style={{ padding: '14px 16px' }}>
                                        <p style={{ color: '#F0F0F0', fontFamily: 'Inter, sans-serif', fontSize: '14px', margin: 0 }}>{budget.tattoo}</p>
                                        <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '12px', margin: '1px 0 0' }}>{budget.location} · {budget.size}</p>
                                    </td>

                                    {/* Status */}
                                    <td style={{ padding: '14px 16px' }}><StatusBadge status={budget.status} /></td>

                                    {/* Valor */}
                                    <td style={{ padding: '14px 16px' }}>
                                        {editingId === budget.id ? (
                                            <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => { setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, value: Number(editValue) } : b)); setEditingId(null); }}
                                                style={{ width: '80px', backgroundColor: '#2B2B2B', border: '1px solid #C9A84C', borderRadius: '4px', color: '#F0F0F0', padding: '4px 8px', fontSize: '13px', outline: 'none' }}
                                                autoFocus />
                                        ) : (
                                            <span onClick={() => { setEditingId(budget.id); setEditValue(String(budget.value)); }}
                                                style={{ color: '#C9A84C', fontFamily: 'Montserrat, sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                                                title="Clique para editar">
                                                R$ {budget.value.toLocaleString('pt-BR')}
                                            </span>
                                        )}
                                    </td>

                                    {/* Data */}
                                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' as const }}>
                                        <span style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
                                            {new Date(budget.date).toLocaleDateString('pt-BR')}
                                        </span>
                                    </td>

                                    {/* Ações */}
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            {/* Ver detalhes (sempre visível fora da lixeira) */}
                                            {filter !== 'lixeira' && actionBtn('Ver detalhes', <Eye size={14} />, () => { setSelectedBudget(budget); markAsRead(budget.firestoreId); }, '#C9A84C')}

                                            {/* Visualizar Ficha de Anamnese */}
                                            {budget.anamneseUrl && actionBtn(
                                                'Visualizar Ficha de Anamnese',
                                                <FileImage size={14} />,
                                                () => window.open(budget.anamneseUrl, '_blank', 'noopener,noreferrer'),
                                                '#7EB8F7'
                                            )}

                                            {filter === 'lixeira' ? (
                                                <>
                                                    {/* Restaurar */}
                                                    {actionBtn('Restaurar orçamento', <RefreshCcw size={14} />, () => handleRestore(budget), '#5CC98A')}
                                                    {/* Excluir permanentemente */}
                                                    {actionBtn('Excluir permanentemente', <Trash2 size={14} />, () => handlePermanentDelete(budget), '#E05252')}
                                                </>
                                            ) : (
                                                <>
                                                    {/* WhatsApp */}
                                                    <a href={`https://wa.me/${budget.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${budget.client.split(' ')[0]}! Aqui é a GABIINK Tattoo Studio. 🐆`)}`}
                                                        target="_blank" rel="noreferrer" title="WhatsApp"
                                                        style={{ background: 'none', border: '1px solid #2B2B2B', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', color: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', textDecoration: 'none', flexShrink: 0 }}
                                                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#25D366'; (e.currentTarget as HTMLAnchorElement).style.color = '#25D366'; }}
                                                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2B2B2B'; (e.currentTarget as HTMLAnchorElement).style.color = '#4A4A4A'; }}>
                                                        <MessageCircle size={14} />
                                                    </a>
                                                    {/* Mover para lixeira */}
                                                    {actionBtn('Mover para lixeira', <Trash2 size={14} />, () => handleDelete(budget), '#E05252')}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedBudget && (
                <ClientModal
                    budget={selectedBudget}
                    onClose={() => setSelectedBudget(null)}
                    onSave={handleSave}
                />
            )}

            {newBudget && (
                <ClientModal
                    budget={newBudget}
                    onClose={() => setNewBudget(null)}
                    onSave={handleSave}
                    onCreated={() => setNewBudget(null)}
                />
            )}
        </div>
    );
}

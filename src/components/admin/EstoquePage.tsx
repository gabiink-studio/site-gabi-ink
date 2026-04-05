import React, { useState } from 'react';
import { Plus, AlertTriangle, X, Package, Trash2, Edit3 } from 'lucide-react';
import { useStock, type StockItem } from '../../context/StockContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';

type StockCategory = 'Instrumentos' | 'EPI / Higiene' | 'Consumíveis' | 'Tintas' | 'Stencil' | 'Uso Geral';
type Category = 'Todos' | StockCategory;

const categories: Category[] = ['Todos', 'Instrumentos', 'EPI / Higiene', 'Consumíveis', 'Tintas', 'Stencil', 'Uso Geral'];

const categoryIcons: Record<string, string> = {
    Instrumentos: '🔧', 'EPI / Higiene': '🧤', Consumíveis: '💉', Tintas: '🎨', Stencil: '📄', 'Uso Geral': '📦',
};

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Sanitiza quantidades de estoque eliminando errôs de ponto flutuante binário.
 * Arredonda para no máximo 4 casas decimais.
 * Retorna número inteiro quando aplicável (ex: 10, não 10.0000).
 */
const formatStockQty = (n: number): number => Number(parseFloat(n.toFixed(4)));

// ─── MODAL DE EDIÇÃO / NOVO PRODUTO ─────────────────────────────────────────
function EditStockModal({ item, onClose }: { item: StockItem | null | 'new', onClose: () => void }) {
    const { updateItemInFirestore, stock } = useStock();
    const [name, setName] = useState(item && item !== 'new' ? item.name : '');
    const [min, setMin] = useState(item && item !== 'new' ? item.min : 0);
    const [qty, setQty] = useState(item && item !== 'new' ? item.qty : 0);
    const [unit, setUnit] = useState(item && item !== 'new' ? item.unit : 'un');
    const [category, setCategory] = useState<StockCategory>(item && item !== 'new' ? item.category as StockCategory : 'Uso Geral');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (item === 'new') {
            const nextId = stock.length > 0 ? Math.max(...stock.map((i: StockItem) => i.id)) + 1 : 1;
            await addDoc(collection(db, 'estoque'), {
                id: nextId,
                name,
                min: Number(min),
                // ✅ AQUI JÁ ESTÁ CERTO
                qty: formatStockQty(Number(qty)),
                unit,
                category,
                unitCost: 0,
                lastUpdated: serverTimestamp()
            });
        } else if (item?.firestoreId) {
            await updateItemInFirestore(item.firestoreId, {
                name,
                min: Number(min),
                // ✅ ADICIONE A LINHA ABAIXO PARA LIMPAR NA EDIÇÃO TAMBÉM
                qty: formatStockQty(Number(qty)),
                category: category as StockCategory,
                unit,
            });
        }
        setSaving(false);
        onClose();
    };

    const handleDelete = async () => {
        if (item && item !== 'new' && item.firestoreId) {
            if (window.confirm(`Excluir "${item.name}" permanentemente?`)) {
                setSaving(true);
                await deleteDoc(doc(db, 'estoque', item.firestoreId));
                setSaving(false);
                onClose();
            }
        }
    };

    const inp = {
        width: '100%', backgroundColor: '#545454', border: '1px solid #4A4A4A',
        borderRadius: '6px', color: '#F0F0F0', padding: '10px 14px', fontSize: '15px', outline: 'none',
        fontFamily: 'Inter, sans-serif', marginBottom: '16px'
    };

    const lbl = { display: 'block', color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: '6px', letterSpacing: '1px' };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 500 }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(450px, 95vw)', backgroundColor: '#1E1E1E', border: '1px solid #C9A84C', borderRadius: '12px', padding: '32px', zIndex: 501, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#F0F0F0', fontSize: '22px', margin: 0 }}>{item === 'new' ? 'Novo Produto' : 'Editar Produto'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <label style={lbl}>Nome do Produto</label>
                <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Agulha 3RL" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <label style={lbl}>Categoria</label>
                        <select style={inp} value={category} onChange={e => setCategory(e.target.value as StockCategory)}>
                            {categories.filter(c => c !== 'Todos').map(c => <option key={c} value={c} style={{ backgroundColor: '#1E1E1E' }}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={lbl}>Unidade</label>
                        <input style={inp} value={unit} onChange={e => setUnit(e.target.value)} placeholder="un, ml, cx..." />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <label style={lbl}>Mínimo para Alerta</label>
                        <input type="number" style={inp} value={min} onChange={e => setMin(Number(e.target.value))} />
                    </div>
                    {item === 'new' && (
                        <div>
                            <label style={lbl}>Estoque Inicial</label>
                            <input type="number" style={inp} value={qty} onChange={e => setQty(Number(e.target.value))} />
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', alignItems: 'center' }}>
                    {item !== 'new' ? (
                        <button onClick={handleDelete} style={{ color: '#8B1A1A', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'Montserrat', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Trash2 size={14} /> EXCLUIR PRODUTO
                        </button>
                    ) : <div />}
                    <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#1E1E1E', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat' }}>
                        {saving ? '...' : 'SALVAR'}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── PURCHASE MODAL ──────────────────────────────────────────────────────────
function PurchaseModal({ items, onClose, onRegister }: {
    items: StockItem[];
    onClose: () => void;
    onRegister: (itemId: number, qty: number, unitCost: number, dataCompra: string, fornecedor: string, observacoes: string, totalPago: number) => void;
}) {
    const [selectedId, setSelectedId] = useState<number | ''>('');
    const [qty, setQty] = useState('');
    const [totalCost, setTotalCost] = useState('');
    const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0]);
    const [fornecedor, setFornecedor] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [focused, setFocused] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const unitCost = qty && totalCost && Number(qty) > 0 ? Number(totalCost) / Number(qty) : null;

    // CORREÇÃO selectedItem: Identificando o item para usar no label
    const selectedItem = items.find(i => i.id === Number(selectedId));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedId && qty && totalCost) {
            setSaving(true);
            await onRegister(Number(selectedId), Number(qty), unitCost ?? 0, dataCompra, fornecedor, observacoes, Number(totalCost));
            setSaving(false);
            onClose();
        }
    };

    const inpStyle = (field: string): React.CSSProperties => ({
        width: '100%', backgroundColor: '#545454', border: `1px solid ${focused === field ? '#C9A84C' : '#4A4A4A'}`,
        borderRadius: '6px', color: '#F0F0F0', padding: '10px 14px', fontSize: '15px', outline: 'none', fontFamily: 'Inter, sans-serif'
    });

    const lblStyle: React.CSSProperties = { display: 'block', color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 400 }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, 95vw)', backgroundColor: '#1E1E1E', border: '1px solid #C9A84C', borderRadius: '12px', padding: '32px', zIndex: 401, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#F0F0F0', fontSize: '22px', fontWeight: 700, margin: 0 }}>Registrar Compra</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#A0A0A0' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={lblStyle}>Item *</label>
                        <select value={selectedId} onChange={e => setSelectedId(Number(e.target.value))} onFocus={() => setFocused('item')} onBlur={() => setFocused(null)} required style={inpStyle('item')}>
                            <option value="" style={{ backgroundColor: '#1E1E1E' }}>Selecione...</option>
                            {items.map(item => <option key={item.id} value={item.id} style={{ backgroundColor: '#1E1E1E' }}>{item.name} ({item.unit})</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <input type="date" value={dataCompra} onChange={e => setDataCompra(e.target.value)} onFocus={() => setFocused('date')} onBlur={() => setFocused(null)} required style={{ ...inpStyle('date'), colorScheme: 'dark' }} />

                        {/* CORREÇÃO selectedItem: Usado aqui no placeholder/label para mostrar a unidade */}
                        <div style={{ position: 'relative' }}>
                            <label style={lblStyle}>Qtd {selectedItem ? `(${selectedItem.unit})` : ''}</label>
                            <input type="number" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} onFocus={() => setFocused('qty')} onBlur={() => setFocused(null)} required style={inpStyle('qty')} />
                        </div>
                    </div>
                    <input type="text" placeholder="Fornecedor" value={fornecedor} onChange={e => setFornecedor(e.target.value)} onFocus={() => setFocused('fornecedor')} onBlur={() => setFocused(null)} style={inpStyle('fornecedor')} />
                    <input type="number" step="0.01" placeholder="Total Pago (R$)" value={totalCost} onChange={e => setTotalCost(e.target.value)} onFocus={() => setFocused('cost')} onBlur={() => setFocused(null)} required style={inpStyle('cost')} />
                    {unitCost !== null && (
                        <div style={{ backgroundColor: 'rgba(201, 168, 76, 0.08)', border: '1px solid #C9A84C40', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#A0A0A0', fontFamily: 'Montserrat', fontSize: '12px' }}>Custo unitário:</span>
                            <span style={{ color: '#C9A84C', fontFamily: 'Playfair Display', fontSize: '20px', fontWeight: 700 }}>R$ {fmt(unitCost)}</span>
                        </div>
                    )}
                    <textarea placeholder="Observações..." value={observacoes} onChange={e => setObservacoes(e.target.value)} onFocus={() => setFocused('obs')} onBlur={() => setFocused(null)} rows={3} style={{ ...inpStyle('obs'), resize: 'vertical' }} />
                    <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#1E1E1E', border: 'none', borderRadius: '8px', padding: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat' }}>
                        {saving ? 'Salvando...' : 'Registrar Entrada'}
                    </button>
                </form>
            </div>
        </>
    );
}

// ─── STOCK CARD ──────────────────────────────────────────────────────────────
function StockCard({ item, onEdit }: { item: StockItem, onEdit: (item: StockItem) => void }) {
    const isLow = item.qty < item.min;
    const percentage = Math.min((item.qty / Math.max(item.min, 1)) * 100, 100);

    return (
        <div
            onClick={() => onEdit(item)}
            style={{ backgroundColor: '#1E1E1E', borderRadius: '8px', padding: '20px', border: `1px solid ${isLow ? '#8B1A1A' : '#2B2B2B'}`, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#C9A84C'}
            onMouseLeave={e => e.currentTarget.style.borderColor = isLow ? '#8B1A1A' : '#2B2B2B'}
        >
            {isLow && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#8B1A1A', borderRadius: '20px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={11} style={{ color: '#FFB3B3' }} />
                    <span style={{ color: '#FFB3B3', fontFamily: 'Montserrat', fontSize: '10px', fontWeight: 700 }}>BAIXO</span>
                </div>
            )}
            <p style={{ color: '#A0A0A0', fontFamily: 'Montserrat', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 6px' }}>
                {categoryIcons[item.category]} {item.category}
            </p>
            <h3 style={{ color: '#F0F0F0', fontFamily: 'Inter', fontSize: '15px', fontWeight: 500, margin: '0 0 12px' }}>{item.name}</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '12px' }}>
                <span style={{ color: isLow ? '#FFB3B3' : '#C9A84C', fontFamily: 'Playfair Display', fontSize: '32px', fontWeight: 700 }}>{formatStockQty(item.qty)}</span>
                <span style={{ color: '#4A4A4A', fontFamily: 'Inter', fontSize: '14px' }}>{item.unit}</span>
                <span style={{ color: '#4A4A4A', fontFamily: 'Inter', fontSize: '12px', marginLeft: '4px' }}>/ mín. {item.min}</span>
            </div>
            <div style={{ backgroundColor: '#2B2B2B', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${percentage}%`, background: isLow ? 'linear-gradient(90deg, #8B1A1A, #E05252)' : 'linear-gradient(90deg, #C9A84C, #E2C97E)', borderRadius: '4px' }} />
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '12px', opacity: 0.3 }}><Edit3 size={12} color="#A0A0A0" /></div>
        </div>
    );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export function EstoquePage() {
    const { stock, loading, updateItemInFirestore } = useStock();
    const [activeCategory, setActiveCategory] = useState<Category>('Todos');
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [editingItem, setEditingItem] = useState<StockItem | null | 'new'>(null);

    const filtered = activeCategory === 'Todos' ? stock : stock.filter(item => item.category === activeCategory);
    const lowCount = stock.filter(item => item.qty < item.min).length;

    const handleRegisterPurchase = async (itemId: number, qty: number, unitCost: number, dataCompra: string, fornecedor: string, observacoes: string, totalPago: number) => {
        const item = stock.find(i => i.id === itemId);
        if (!item || !item.firestoreId) return;
        const newQty = formatStockQty(item.qty + qty);
        await updateItemInFirestore(item.firestoreId, { qty: newQty, unitCost: unitCost > 0 ? unitCost : item.unitCost });
        await addDoc(collection(db, 'historico_compras'), {
            itemId: item.id, itemName: item.name, dataCompra, fornecedor, qtdComprada: qty, valorTotalPago: totalPago, observacoes, criadoEm: serverTimestamp(),
        });
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#C9A84C', fontFamily: 'Montserrat' }}>Carregando estoque...</div>;

    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontFamily: 'Playfair Display', color: '#F0F0F0', fontSize: '26px', margin: 0 }}>Gerenciamento de Estoque</h1>
                    {lowCount > 0 && <p style={{ color: '#FFB3B3', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> {lowCount} itens abaixo do mínimo</p>}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {/* CORREÇÃO Plus: Usado no botão de Novo Produto */}
                    <button
                        onClick={() => setEditingItem('new')}
                        style={{ backgroundColor: 'transparent', border: '1px solid #C9A84C', color: '#C9A84C', borderRadius: '8px', padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Plus size={18} /> NOVO PRODUTO
                    </button>
                    <button onClick={() => setShowPurchaseModal(true)} style={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#1E1E1E', border: 'none', borderRadius: '8px', padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat', fontSize: '13px' }}>REGISTRAR COMPRA</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
                {categories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${activeCategory === cat ? '#C9A84C' : '#4A4A4A'}`, background: activeCategory === cat ? 'rgba(201,168,76,0.1)' : 'transparent', color: activeCategory === cat ? '#C9A84C' : '#A0A0A0', cursor: 'pointer', fontFamily: 'Montserrat', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {cat}
                    </button>
                ))}
            </div>

            {filtered.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                    {filtered.map(item => <StockCard key={item.id} item={item} onEdit={setEditingItem} />)}
                </div>
            ) : (
                /* CORREÇÃO Package: Usado para o estado vazio da categoria */
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#4A4A4A' }}>
                    <Package size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                    <p style={{ fontFamily: 'Montserrat', fontSize: '14px' }}>Nenhum item encontrado nesta categoria.</p>
                </div>
            )}

            {showPurchaseModal && <PurchaseModal items={stock} onClose={() => setShowPurchaseModal(false)} onRegister={handleRegisterPurchase} />}
            {editingItem && <EditStockModal item={editingItem} onClose={() => setEditingItem(null)} />}
        </div>
    );
}
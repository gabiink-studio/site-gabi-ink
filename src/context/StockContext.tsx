import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, writeBatch } from 'firebase/firestore';

export type StockCategory = 'Instrumentos' | 'EPI / Higiene' | 'Consumíveis' | 'Tintas' | 'Stencil' | 'Uso Geral';

/**
 * Sanitiza quantidades de estoque eliminando erros de ponto flutuante binário.
 * Exportada para uso em todos os componentes que gravam/exibem qty.
 */
export const formatStockQty = (n: number): number => Number(parseFloat(n.toFixed(4)));

export interface StockItem {
    id: number;
    firestoreId?: string;
    name: string;
    category: StockCategory;
    qty: number;          // quantidade de pacotes/unidades no estoque
    min: number;          // mínimo de pacotes/unidades
    unit: string;         // unidade do pacote (cx, rl, fr, un...)
    unitCost: number;     // custo médio por pacote/unidade (R$)
    // ── Fracionamento ──────────────────────────────────────────────────
    qtdPorPacote?: number;   // ex: 100 (luvas por caixa), 30 (ml por frasco)
    unidadeDeUso?: string;   // ex: 'par', 'ml', 'un' — unidade consumida no atendimento
    // custoUso = unitCost / qtdPorPacote (calculado on-the-fly)
}

export const initialStock: StockItem[] = [
    // Instrumentos
    { id: 1, name: 'Máquina Rotativa', category: 'Instrumentos', qty: 3, min: 2, unit: 'un', unitCost: 0 },
    { id: 2, name: 'Fonte de Energia', category: 'Instrumentos', qty: 2, min: 1, unit: 'un', unitCost: 0 },
    { id: 3, name: 'Grip / Tubo', category: 'Instrumentos', qty: 5, min: 3, unit: 'un', unitCost: 0 },
    // EPI / Higiene — fracionado por par/unidade
    { id: 4, name: 'Luvas Nitrílicas M', category: 'EPI / Higiene', qty: 2, min: 5, unit: 'cx', unitCost: 28.90, qtdPorPacote: 100, unidadeDeUso: 'par' },
    { id: 5, name: 'Máscara Descartável', category: 'EPI / Higiene', qty: 10, min: 5, unit: 'cx', unitCost: 15.50, qtdPorPacote: 50, unidadeDeUso: 'un' },
    { id: 6, name: 'Touca Descartável', category: 'EPI / Higiene', qty: 3, min: 3, unit: 'cx', unitCost: 12.00, qtdPorPacote: 100, unidadeDeUso: 'un' },
    { id: 7, name: 'Lençol Descartável', category: 'EPI / Higiene', qty: 4, min: 5, unit: 'rl', unitCost: 22.00, qtdPorPacote: 50, unidadeDeUso: 'un' },
    // Consumíveis
    { id: 8, name: 'Agulha Magnum 15', category: 'Consumíveis', qty: 8, min: 10, unit: 'un', unitCost: 2.50 },
    { id: 9, name: 'Agulha Round Liner 5', category: 'Consumíveis', qty: 15, min: 10, unit: 'un', unitCost: 2.00 },
    { id: 10, name: 'Filme Plástico PVC', category: 'Consumíveis', qty: 2, min: 3, unit: 'rl', unitCost: 18.00 },
    { id: 11, name: 'Copo Descartável', category: 'Consumíveis', qty: 80, min: 50, unit: 'un', unitCost: 0.15 },
    // Tintas — fracionado por ml
    { id: 12, name: 'Tinta Preta Dynamic', category: 'Tintas', qty: 3, min: 2, unit: 'fr', unitCost: 35.00, qtdPorPacote: 30, unidadeDeUso: 'ml' },
    { id: 13, name: 'Tinta Vermelha Eternal', category: 'Tintas', qty: 1, min: 2, unit: 'fr', unitCost: 38.00, qtdPorPacote: 30, unidadeDeUso: 'ml' },
    { id: 14, name: 'Tinta Branca Intenze', category: 'Tintas', qty: 2, min: 1, unit: 'fr', unitCost: 42.00, qtdPorPacote: 30, unidadeDeUso: 'ml' },
    { id: 15, name: 'Tinta Azul World Famous', category: 'Tintas', qty: 1, min: 1, unit: 'fr', unitCost: 40.00, qtdPorPacote: 30, unidadeDeUso: 'ml' },
    // Stencil
    { id: 16, name: 'Papel Stencil A4', category: 'Stencil', qty: 25, min: 20, unit: 'fl', unitCost: 1.20 },
    { id: 17, name: 'Cream Stencil', category: 'Stencil', qty: 2, min: 1, unit: 'fr', unitCost: 25.00 },
    { id: 18, name: 'Transfer Paper', category: 'Stencil', qty: 10, min: 15, unit: 'fl', unitCost: 0.80 },
    // Uso Geral
    { id: 19, name: 'Creme Bepantol', category: 'Uso Geral', qty: 4, min: 3, unit: 'un', unitCost: 18.90 },
    { id: 20, name: 'Saco Contaminado Vermelho', category: 'Uso Geral', qty: 30, min: 20, unit: 'un', unitCost: 0.50 },
    { id: 21, name: 'Papel Toalha', category: 'Uso Geral', qty: 5, min: 4, unit: 'rl', unitCost: 8.00 },
];

/** Custo por unidade de uso (fracionado). Se não fracionado, retorna unitCost por pacote */
export function getCustoUso(item: StockItem): number {
    if (item.qtdPorPacote && item.qtdPorPacote > 0 && item.unitCost > 0) {
        return item.unitCost / item.qtdPorPacote;
    }
    return item.unitCost;
}

/** Unidade de uso para exibição no checklist */
export function getUnidadeUso(item: StockItem): string {
    return item.unidadeDeUso ?? item.unit;
}

interface StockContextType {
    stock: StockItem[];
    loading: boolean;
    updateStock: (updater: (prev: StockItem[]) => StockItem[]) => void;
    deductItems: (items: { id: number; qty: number }[]) => void;
    updateItemInFirestore: (firestoreId: string, updates: Partial<StockItem>) => Promise<void>;
}

const StockContext = createContext<StockContextType | null>(null);

export function StockProvider({ children }: { children: React.ReactNode }) {
    const [stock, setStock] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeded, setSeeded] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'estoque'), (snapshot) => {
            if (snapshot.empty && !seeded) {
                setSeeded(true);
                seedInitialStock();
                return;
            }

            const items: StockItem[] = snapshot.docs.map(docSnap => {
                const d = docSnap.data();
                return {
                    id: d.id ?? 0,
                    firestoreId: docSnap.id,
                    name: d.name ?? '',
                    category: d.category ?? 'Uso Geral',
                    qty: Number(d.qty) ?? 0, // Garantindo que seja número
                    min: d.min ?? 0,
                    unit: d.unit ?? 'un',
                    unitCost: Number(d.unitCost) ?? 0,
                    qtdPorPacote: d.qtdPorPacote ? Number(d.qtdPorPacote) : undefined,
                    unidadeDeUso: d.unidadeDeUso ?? undefined,
                };
            });

            items.sort((a, b) => a.id - b.id);
            setStock(items);
            setLoading(false);
        });

        return () => unsub();
    }, [seeded]);

    const seedInitialStock = async () => {
        const batch = writeBatch(db);
        for (const item of initialStock) {
            const docRef = doc(collection(db, 'estoque'));
            batch.set(docRef, {
                id: item.id,
                name: item.name,
                category: item.category,
                qty: item.qty,
                min: item.min,
                unit: item.unit,
                unitCost: item.unitCost,
                // Aqui garantimos que o fracionamento suba pro Firebase
                ...(item.qtdPorPacote !== undefined && { qtdPorPacote: item.qtdPorPacote }),
                ...(item.unidadeDeUso !== undefined && { unidadeDeUso: item.unidadeDeUso }),
            });
        }
        await batch.commit();
        console.log('Estoque inicial semeado com fracionamento!');
    };

    const deductItems = async (items: { id: number; qty: number }[]) => {
        for (const deduction of items) {
            const item = stock.find(i => i.id === deduction.id);
            if (item?.firestoreId) {
                // Lógica de 1.98: Se tem pacote (ex: 100 luvas), divide o uso pela caixa
                const fatorDivisao: number = (item.qtdPorPacote && item.qtdPorPacote > 0)
                    ? item.qtdPorPacote
                    : 1;

                const valorParaSubtrair = deduction.qty / fatorDivisao;
                const newQty = formatStockQty(Math.max(0, item.qty - valorParaSubtrair));

                await setDoc(doc(db, 'estoque', item.firestoreId),
                    { qty: newQty },
                    { merge: true }
                );
            }
        }
    };

    const updateItemInFirestore = async (firestoreId: string, updates: Partial<StockItem>) => {
        await setDoc(doc(db, 'estoque', firestoreId), updates, { merge: true });
    };

    return (
        <StockContext.Provider value={{ stock, loading, updateStock: setStock, deductItems, updateItemInFirestore }}>
            {children}
        </StockContext.Provider>
    );
}

export function useStock() {
    const ctx = useContext(StockContext);
    if (!ctx) throw new Error('useStock must be used within StockProvider');
    return ctx;
}

"use client";

import { useState, useEffect } from 'react';

const initialData = [
  {
    category: "Mięso i Ryby",
    items: [
      { name: "Kurczak (filet z piersi)", brand: "biedronka/lidl", price: 14.99, unit: "zł/kg" },
      { name: "Kurczak (filet z piersi)", brand: "intermash", price: 13.99, unit: "zł/kg" },
      { name: "Mięso wieprzowe (schab)", brand: "", price: 0, unit: "zł/kg" },
      { name: "Mięso wieprzowe (szynka)", brand: "", price: 0, unit: "zł/kg" },
      { name: "Mięso mielone z szynki", brand: "", price: 0, unit: "zł/kg" },
      { name: "Mięso mielone z łopatki", brand: "", price: 0, unit: "zł/kg" },
      { name: "Połędwica Sopocka / Drobiowa", brand: "kraina wędlin 2+1", price: 23, unit: "zł/kg" },
      { name: "Szynka Gotowana", brand: "kraina wędlin 2+1", price: 23, unit: "zł/kg" },
      { name: "Szynka Konserwowa", brand: "kraina wędlin 2+1", price: 20, unit: "zł/kg" },
      { name: "Kiełbasa Krakowska Parzona", brand: "kraina wędlin 2+1", price: 23, unit: "zł/kg" },
      { name: "Łosoś (świeży filet)", brand: "", price: 40, unit: "zł/kg" },
      { name: "Krewetki (mrożone)", brand: "", price: 30, unit: "zł/kg" },
      { name: "Tuńczyk (jednolity sos)", brand: "2+1", price: 27.75, unit: "zł/kg" },
      { name: "Tuńczyk (jednolity olej)", brand: "marinero 2+1", price: 29.19, unit: "zł/kg" },
      { name: "Tuńczyk (kawałki sos)", brand: "2+1", price: 31.77, unit: "zł/kg" },
      { name: "Tuńczyk (kawałki olej)", brand: "marinero 2+1", price: 33.77, unit: "zł/kg" },
      { name: "Paluszki rybne", brand: "", price: 22, unit: "zł/kg" },
      { name: "Parówki", brand: "", price: 17.50, unit: "zł/kg" },
    ]
  },
  {
    category: "Nabiał i Jaja",
    items: [
      { name: "Jaja (rozmiar L/M)", brand: "", price: 12, unit: "zł/kg" },
      { name: "Jogurt typu Skyr", brand: "zniżka - 18%", price: 11.93, unit: "zł/kg" },
      { name: "Twaróg", brand: "zniżka - 40%", price: 11.50, unit: "zł/kg" },
      { name: "Twaróg", brand: "2+1", price: 10.40, unit: "zł/kg" },
      { name: "Mleko", brand: "", price: 2.20, unit: "zł/l" },
      { name: "Kefir / Jogurt naturalny", brand: "", price: 3.60, unit: "zł/kg" },
      { name: "Ser żółty", brand: "", price: 20, unit: "zł/kg" },
    ]
  },
  {
    category: "Warzywa i Owoce",
    items: [
      { name: "Pieczarki", brand: "", price: 7, unit: "zł/kg" },
      { name: "Awokado (Hass)", brand: "", price: 16, unit: "zł/kg" },
      { name: "Kukurydza w puszce", brand: "", price: 12, unit: "zł/kg" },
      { name: "Banan", brand: "", price: 3.70, unit: "zł/kg" },
      { name: "Pomarańcza / Mandarynka", brand: "", price: 4.20, unit: "zł/kg" },
      { name: "Winogrona", brand: "", price: 10.50, unit: "zł/kg" },
      { name: "Kiwi", brand: "", price: 10, unit: "zł/kg" },
      { name: "Mango", brand: "", price: 15, unit: "zł/kg" },
      { name: "Cytryna", brand: "", price: 8.50, unit: "zł/kg" },
      { name: "Borówka amerykańska", brand: "", price: 30, unit: "zł/kg" },
    ]
  },
  {
    category: "Mrożonki i Inne",
    items: [
      { name: "Owoce mrożone (borówka/brzoskwinia)", brand: "2+1", price: 15.54, unit: "zł/kg" },
      { name: "Pizza mrożona", brand: "40%", price: 22.63, unit: "zł/kg" },
      { name: "Ketchup", brand: "madero 2+1", price: 5.23, unit: "zł/kg" },
      { name: "Owoce / Warzywa suszone", brand: "", price: 40, unit: "zł/kg" },
      { name: "Dżem", brand: "2+1", price: 8.11, unit: "zł/kg" },
    ]
  },
  {
    category: "Bakalie",
    items: [
      { name: "Pistacje", brand: "", price: 45, unit: "zł/kg" },
      { name: "Orzechy nerkowca", brand: "bakello 2+1", price: 41.20, unit: "zł/kg" },
      { name: "Migdały", brand: "bakador 2+1", price: 37.00, unit: "zł/kg" },
      { name: "Migdały", brand: "bakador 3+3", price: 32.38, unit: "zł/kg" },
      { name: "Orzechy włoskie", brand: "2+1", price: 44.43, unit: "zł/kg" },
      { name: "Rodzynki", brand: "bakador 2+1", price: 17.30, unit: "zł/kg" },
      { name: "Rodzynki", brand: "bakello 2+1", price: 14.50, unit: "zł/kg" },
    ]
  },
  {
    category: "Artykuлы domowe",
    items: [
      { name: "Olej Rzepakowy (z oliwek)", brand: "40%", price: 37, unit: "zł/l" },
      { name: "Ręcznik papierowy", brand: "", price: 15, unit: "zł/kg" },
      { name: "Nivea z kolkiem", brand: "rossman wyprzedaż", price: 9.99, unit: "zł/szt" },
      { name: "Nivea z kolkiem", brand: "1+1 biedronka", price: 8.25, unit: "zł/szt" },
      { name: "Odżywka białkowa", brand: "Olimp Whey 2+1", price: 66, unit: "zł/kg" },
    ]
  }
];

export default function PricesPage() {
  const [data, setData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCatIdx, setNewCatIdx] = useState(0);
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('zł/kg');

  useEffect(() => {
    const saved = localStorage.getItem('webPricesData');
    if (saved) {
      setData(JSON.parse(saved));
    } else {
      setData(initialData);
    }
  }, []);

  const saveData = (newData) => {
    setData(newData);
    localStorage.setItem('webPricesData', JSON.stringify(newData));
  };

  const handleDelete = (cIdx, iIdx) => {
    if (window.confirm('Удалить этот товар?')) {
      const newData = [...data];
      newData[cIdx].items.splice(iIdx, 1);
      saveData(newData);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return alert('Введите название продукта!');
    const newData = [...data];
    newData[newCatIdx].items.push({
      name: newName.trim(),
      brand: newBrand.trim(),
      price: parseFloat(newPrice) || 0,
      unit: newUnit
    });
    saveData(newData);
    setIsModalOpen(false);
    setNewName('');
    setNewBrand('');
    setNewPrice('');
  };

  if (data.length === 0) return <div style={{padding: 20}}>Загрузка...</div>;

  return (
    <div className="tasks-page" style={{ paddingBottom: '80px' }}>
      <div className="tasks-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Мониторинг цен</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ background: 'var(--primary-color)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
        >
          + Добавить
        </button>
      </div>

      <div className="tasks-body" style={{ padding: '0 16px', gap: '24px', display: 'flex', flexDirection: 'column' }}>
        {data.map((cat, cIdx) => (
          <div key={cat.category} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--primary-color)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
              {cat.category}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cat.items.map((item, iIdx) => (
                <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 30, 30, 0.5)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.brand || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary-color)', background: 'var(--primary-dim)', padding: '4px 8px', borderRadius: '6px' }}>
                      {item.price.toFixed(2)} {item.unit}
                    </div>
                    <button 
                      onClick={() => handleDelete(cIdx, iIdx)}
                      style={{ background: 'rgba(255, 69, 58, 0.1)', color: '#FF453A', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Добавить товар</h2>
            <div className="form-group mt-2">
              <label>Категория</label>
              <select className="styled-input w-100" value={newCatIdx} onChange={e => setNewCatIdx(Number(e.target.value))}>
                {data.map((cat, i) => <option key={i} value={i}>{cat.category}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Название продукта</label>
              <input type="text" className="styled-input w-100" placeholder="Например: Kurczak" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Бренд / Магазин / Акция</label>
              <input type="text" className="styled-input w-100" placeholder="Например: biedronka 2+1" value={newBrand} onChange={e => setNewBrand(e.target.value)} />
            </div>
            <div className="form-group" style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label>Цена</label>
                <input type="number" step="0.01" className="styled-input w-100" placeholder="0.00" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Ед. изм.</label>
                <select className="styled-input w-100" value={newUnit} onChange={e => setNewUnit(e.target.value)}>
                  <option value="zł/kg">zł/kg</option>
                  <option value="zł/l">zł/l</option>
                  <option value="zł/szt">zł/szt</option>
                </select>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '20px', flexDirection: 'row', gap: '12px' }}>
              <button className="btn btn-secondary w-100" onClick={() => setIsModalOpen(false)}>Отмена</button>
              <button className="btn btn-primary w-100" onClick={handleAdd}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';

const initialData = [
  {
    category: "Mięso i Ryby",
    items: [
      { name: "Kurczak (filet z piersi)", stores: [{ brand: "biedronka/lidl", price: 14.99, unit: "zł/kg" }, { brand: "intermash", price: 13.99, unit: "zł/kg" }] },
      { name: "Mięso wieprzowe (schab)", stores: [{ brand: "-", price: 0, unit: "zł/kg" }] },
      { name: "Mięso wieprzowe (szynka)", stores: [{ brand: "-", price: 0, unit: "zł/kg" }] },
      { name: "Mięso mielone z szynki", stores: [{ brand: "-", price: 0, unit: "zł/kg" }] },
      { name: "Mięso mielone z łopatki", stores: [{ brand: "-", price: 0, unit: "zł/kg" }] },
      { name: "Połędwica Sopocka / Drobiowa", stores: [{ brand: "kraina wędlin 2+1", price: 23, unit: "zł/kg" }] },
      { name: "Szynka Gotowana", stores: [{ brand: "kraina wędlin 2+1", price: 23, unit: "zł/kg" }] },
      { name: "Szynka Konserwowa", stores: [{ brand: "kraina wędlin 2+1", price: 20, unit: "zł/kg" }] },
      { name: "Kiełbasa Krakowska Parzona", stores: [{ brand: "kraina wędlin 2+1", price: 23, unit: "zł/kg" }] },
      { name: "Łosoś (świeży filet)", stores: [{ brand: "-", price: 40, unit: "zł/kg" }] },
      { name: "Krewetki (mrożone)", stores: [{ brand: "-", price: 30, unit: "zł/kg" }] },
      { name: "Tuńczyk (jednolity sos)", stores: [{ brand: "2+1", price: 27.75, unit: "zł/kg" }] },
      { name: "Tuńczyk (jednolity olej)", stores: [{ brand: "marinero 2+1", price: 29.19, unit: "zł/kg" }] },
      { name: "Tuńczyk (kawałki sos)", stores: [{ brand: "2+1", price: 31.77, unit: "zł/kg" }] },
      { name: "Tuńczyk (kawałki olej)", stores: [{ brand: "marinero 2+1", price: 33.77, unit: "zł/kg" }] },
      { name: "Paluszki rybne", stores: [{ brand: "-", price: 22, unit: "zł/kg" }] },
      { name: "Parówki", stores: [{ brand: "-", price: 17.50, unit: "zł/kg" }] },
    ]
  },
  {
    category: "Nabiał i Jaja",
    items: [
      { name: "Jaja (rozmiar L/M)", stores: [{ brand: "-", price: 12, unit: "zł/kg" }] },
      { name: "Jogurt typu Skyr", stores: [{ brand: "zniżka - 18%", price: 11.93, unit: "zł/kg" }] },
      { name: "Twaróg", stores: [{ brand: "zniżka - 40%", price: 11.50, unit: "zł/kg" }, { brand: "2+1", price: 10.40, unit: "zł/kg" }] },
      { name: "Mleko", stores: [{ brand: "-", price: 2.20, unit: "zł/l" }] },
      { name: "Kefir / Jogurt naturalny", stores: [{ brand: "-", price: 3.60, unit: "zł/kg" }] },
      { name: "Ser żółty", stores: [{ brand: "-", price: 20, unit: "zł/kg" }] },
    ]
  },
  {
    category: "Warzywa i Owoce",
    items: [
      { name: "Pieczarki", stores: [{ brand: "-", price: 7, unit: "zł/kg" }] },
      { name: "Awokado (Hass)", stores: [{ brand: "-", price: 16, unit: "zł/kg" }] },
      { name: "Kukurydza w puszce", stores: [{ brand: "-", price: 12, unit: "zł/kg" }] },
      { name: "Banan", stores: [{ brand: "-", price: 3.70, unit: "zł/kg" }] },
      { name: "Pomarańcza / Mandarynka", stores: [{ brand: "-", price: 4.20, unit: "zł/kg" }] },
      { name: "Winogrona", stores: [{ brand: "-", price: 10.50, unit: "zł/kg" }] },
      { name: "Kiwi", stores: [{ brand: "-", price: 10, unit: "zł/kg" }] },
      { name: "Mango", stores: [{ brand: "-", price: 15, unit: "zł/kg" }] },
      { name: "Cytryna", stores: [{ brand: "-", price: 8.50, unit: "zł/kg" }] },
      { name: "Borówka amerykańska", stores: [{ brand: "-", price: 30, unit: "zł/kg" }] },
    ]
  },
  {
    category: "Mrożonki i Inne",
    items: [
      { name: "Owoce mrożone (borówka/brzoskwinia)", stores: [{ brand: "2+1", price: 15.54, unit: "zł/kg" }] },
      { name: "Pizza mrożona", stores: [{ brand: "40%", price: 22.63, unit: "zł/kg" }] },
      { name: "Ketchup", stores: [{ brand: "madero 2+1", price: 5.23, unit: "zł/kg" }] },
      { name: "Owoce / Warzywa suszone", stores: [{ brand: "-", price: 40, unit: "zł/kg" }] },
      { name: "Dżem", stores: [{ brand: "2+1", price: 8.11, unit: "zł/kg" }] },
    ]
  },
  {
    category: "Bakalie",
    items: [
      { name: "Pistacje", stores: [{ brand: "-", price: 45, unit: "zł/kg" }] },
      { name: "Orzechy nerkowca", stores: [{ brand: "bakello 2+1", price: 41.20, unit: "zł/kg" }] },
      { name: "Migdały", stores: [{ brand: "bakador 2+1", price: 37.00, unit: "zł/kg" }, { brand: "bakador 3+3", price: 32.38, unit: "zł/kg" }] },
      { name: "Orzechy włoskie", stores: [{ brand: "2+1", price: 44.43, unit: "zł/kg" }] },
      { name: "Rodzynki", stores: [{ brand: "bakador 2+1", price: 17.30, unit: "zł/kg" }, { brand: "bakello 2+1", price: 14.50, unit: "zł/kg" }] },
    ]
  },
  {
    category: "Artykuły domowe",
    items: [
      { name: "Olej Rzepakowy (z oliwek)", stores: [{ brand: "40%", price: 37, unit: "zł/l" }] },
      { name: "Ręcznik papierowy", stores: [{ brand: "-", price: 15, unit: "zł/kg" }] },
      { name: "Nivea z kolkiem", stores: [{ brand: "rossman wyprzedaż", price: 9.99, unit: "zł/szt" }, { brand: "1+1 biedronka", price: 8.25, unit: "zł/szt" }] },
      { name: "Odżywka białkowa", stores: [{ brand: "Olimp Whey 2+1", price: 66, unit: "zł/kg" }] },
    ]
  }
];

export default function PricesPage() {
  const [data, setData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(''); // 'new_product', 'new_store', 'edit_store'
  const [editingItem, setEditingItem] = useState(null); // { cIdx, iIdx, sIdx? }
  
  const [newCatIdx, setNewCatIdx] = useState(0);
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('zł/kg');

  useEffect(() => {
    const saved = localStorage.getItem('webPricesData');
    let loadedData = saved ? JSON.parse(saved) : initialData;

    // Migration to Multi-Store format
    let migrated = false;
    loadedData = loadedData.map(cat => {
      const newItemsMap = new Map();
      
      cat.items.forEach(item => {
        if (!item.stores) {
          migrated = true;
          if (!newItemsMap.has(item.name)) {
            newItemsMap.set(item.name, { name: item.name, stores: [] });
          }
          newItemsMap.get(item.name).stores.push({ brand: item.brand, price: item.price, unit: item.unit });
        } else {
          newItemsMap.set(item.name, item);
        }
      });
      return { ...cat, items: Array.from(newItemsMap.values()) };
    });

    if (migrated) {
      localStorage.setItem('webPricesData', JSON.stringify(loadedData));
    }
    
    setData(loadedData);
  }, []);

  const saveData = (newData) => {
    setData(newData);
    localStorage.setItem('webPricesData', JSON.stringify(newData));
  };

  const handleDeleteProduct = (cIdx, iIdx) => {
    const newData = [...data];
    newData[cIdx].items.splice(iIdx, 1);
    saveData(newData);
  };

  const handleDeleteStore = (cIdx, iIdx, sIdx) => {
    const newData = [...data];
    newData[cIdx].items[iIdx].stores.splice(sIdx, 1);
    if (newData[cIdx].items[iIdx].stores.length === 0) {
      newData[cIdx].items.splice(iIdx, 1);
    }
    saveData(newData);
  };

  const openAddProductModal = () => {
    setModalMode('new_product');
    setEditingItem(null);
    setNewCatIdx(0);
    setNewName('');
    setNewBrand('');
    setNewPrice('');
    setNewUnit('zł/kg');
    setIsModalOpen(true);
  };

  const openAddStoreModal = (cIdx, iIdx) => {
    setModalMode('new_store');
    setEditingItem({ cIdx, iIdx });
    setNewCatIdx(cIdx);
    setNewName(data[cIdx].items[iIdx].name);
    setNewBrand('');
    setNewPrice('');
    setNewUnit('zł/kg');
    setIsModalOpen(true);
  };

  const openEditStoreModal = (cIdx, iIdx, sIdx) => {
    const store = data[cIdx].items[iIdx].stores[sIdx];
    setModalMode('edit_store');
    setEditingItem({ cIdx, iIdx, sIdx });
    setNewCatIdx(cIdx);
    setNewName(data[cIdx].items[iIdx].name);
    setNewBrand(store.brand);
    setNewPrice(store.price);
    setNewUnit(store.unit);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!newName.trim()) return alert('Введите название продукта!');
    const newData = [...data];
    
    const storeObj = {
      brand: newBrand.trim(),
      price: parseFloat(newPrice) || 0,
      unit: newUnit
    };

    if (modalMode === 'new_product') {
      newData[newCatIdx].items.unshift({
        name: newName.trim(),
        stores: [storeObj]
      });
    } else if (modalMode === 'new_store') {
      const item = newData[editingItem.cIdx].items[editingItem.iIdx];
      item.stores.push(storeObj);
    } else if (modalMode === 'edit_store') {
      const item = newData[editingItem.cIdx].items[editingItem.iIdx];
      if (editingItem.cIdx === newCatIdx && item.name === newName.trim()) {
        item.stores[editingItem.sIdx] = storeObj;
      } else {
        // If they changed category or name, remove from old and add to new (or update name)
        item.stores.splice(editingItem.sIdx, 1);
        if (item.stores.length === 0) {
          newData[editingItem.cIdx].items.splice(editingItem.iIdx, 1);
        }
        
        let foundExisting = newData[newCatIdx].items.find(i => i.name === newName.trim());
        if (foundExisting) {
          foundExisting.stores.push(storeObj);
        } else {
          newData[newCatIdx].items.unshift({
            name: newName.trim(),
            stores: [storeObj]
          });
        }
      }
    }
    
    saveData(newData);
    setIsModalOpen(false);
  };

  if (data.length === 0) return <div style={{padding: 20}}>Загрузка...</div>;

  const filteredData = data.map((cat, cIdx) => {
    const filteredItems = cat.items.map((item, iIdx) => ({ ...item, originalIndex: iIdx }))
      .filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.stores.some(s => s.brand.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    return { ...cat, originalIndex: cIdx, items: filteredItems };
  }).filter(cat => cat.items.length > 0);

  return (
    <div className="tasks-page">
      <div className="tasks-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
               style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }}>
            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Поиск по названию или магазину..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px 10px 10px 36px', 
              borderRadius: '8px', 
              border: '1px solid rgba(255,255,255,0.1)', 
              background: 'rgba(30, 30, 30, 0.5)', 
              color: '#fff',
              fontSize: '14px',
              outline: 'none'
            }} 
          />
        </div>
        <button 
          onClick={openAddProductModal}
          style={{ background: 'var(--primary-color)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}
        >
          + Добавить
        </button>
      </div>

      <div className="tasks-body" style={{ padding: '0 16px', gap: '24px', display: 'flex', flexDirection: 'column' }}>
        {filteredData.map((cat) => (
          <div key={cat.category} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--primary-color)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
              {cat.category}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cat.items.map((item) => (
                <div key={item.originalIndex} style={{ 
                  background: 'rgba(30, 30, 30, 0.5)', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.05)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', wordBreak: 'break-word' }}>
                      {item.name}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => openAddStoreModal(cat.originalIndex, item.originalIndex)}
                        style={{ background: 'rgba(94, 92, 230, 0.2)', color: 'var(--primary-color)', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Добавить цену"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                          <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(cat.originalIndex, item.originalIndex)}
                        style={{ background: 'rgba(255, 69, 58, 0.1)', color: '#FF453A', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Удалить товар"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {item.stores.map((store, sIdx) => (
                      <div key={sIdx} style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'minmax(80px, 2fr) minmax(50px, 1fr) minmax(40px, 0.8fr) 70px', 
                        gap: '8px', 
                        alignItems: 'center',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '8px',
                        borderRadius: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: '600',
                            color: store.brand && store.brand !== '-' ? '#FF9F0A' : 'var(--text-muted)', 
                            background: store.brand && store.brand !== '-' ? 'rgba(255, 159, 10, 0.15)' : 'transparent',
                            padding: store.brand && store.brand !== '-' ? '4px 8px' : '0',
                            borderRadius: '6px',
                            wordBreak: 'break-word',
                            border: store.brand && store.brand !== '-' ? '1px solid rgba(255, 159, 10, 0.3)' : 'none'
                          }}>
                            {store.brand || '-'}
                          </span>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
                          {store.price.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {store.unit}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <button 
                            onClick={() => openEditStoreModal(cat.originalIndex, item.originalIndex, sIdx)}
                            style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                              <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteStore(cat.originalIndex, item.originalIndex, sIdx)}
                            style={{ background: 'transparent', color: '#FF453A', border: 'none', padding: '8px', cursor: 'pointer', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
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
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>
              {modalMode === 'new_product' ? 'Добавить товар' : 
               modalMode === 'new_store' ? 'Добавить цену' : 'Редактировать цену'}
            </h2>
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
              <label>Магазин / Бренд / Акция</label>
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
              <button className="btn btn-primary w-100" onClick={handleSave}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

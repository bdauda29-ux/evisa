(function (g) {
  'use strict';

  const norm = s => String(s == null ? '' : s).trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  };
  const report = (message, extra = {}) => {
    const payload = { message, url: location.href, ...extra };
    try { chrome.runtime.sendMessage({ type: 'EVISA_EVENT', payload }); } catch (_) {}
    console.log('[eVisa Device Browser]', message, extra);
  };

  const aliases = {
    nationality: ['nationality', 'countryofnationality', 'nationalitycountry'],
    visa_category: ['visacategory', 'visatype', 'classofvisa', 'classvisa'],
    passport_type: ['passporttype', 'typeofpassport'],
    title: ['title'], surname: ['surname', 'lastname', 'familyname'], first_name: ['firstname', 'givenname', 'forename'],
    other_names: ['othernames', 'middlename'], date_of_birth: ['dateofbirth', 'dob', 'birthdate'], place_of_birth: ['placeofbirth', 'birthplace'],
    gender: ['gender', 'sex'], marital_status: ['maritalstatus'], passport_number: ['passportnumber', 'passportno'],
    passport_expiry_date: ['passportexpirydate', 'passportexpiry', 'expirydate'],
    has_nigerian_passport: ['hasnigerianpassport', 'nigerianpassport', 'doyouhavenigerianpassport', 'doyouhaveanigerianpassport', 'heldnigerianpassport'],
    purpose_of_journey: ['purposeofjourney', 'journeypurpose', 'purposeoftravel', 'purpose'], travel_carrier: ['travelcarrier', 'airlinename', 'carriername', 'carrier'],
    flight_number: ['flightnumber', 'flightno'], country_of_departure: ['countryofdeparture', 'departurecountry'], departure_date: ['departuredate'],
    arrival_date: ['arrivaldate'], arrival_channel: ['arrivalchannel', 'modeofarrival', 'meansofarrival'], duration_of_stay: ['durationofstay', 'stayduration'],
    port_of_entry: ['portofentry', 'entryport', 'arrivalport'], contact_name: ['contactname', 'hostname', 'hostcontactname'],
    contact_phone: ['contactphone', 'phonenumber', 'telephone', 'phone'], contact_address: ['contactaddress', 'hostaddress', 'address'],
    contact_city: ['contactcity', 'city'], contact_state: ['contactstate', 'state'], contact_email: ['contactemail', 'email'], postal_code: ['postalcode', 'postcode', 'zipcode']
  };

  const pageOrder = [
    ['nationality', 'visa_category', 'passport_type'],
    ['title', 'surname', 'first_name', 'other_names', 'date_of_birth', 'place_of_birth', 'gender', 'marital_status', 'passport_number', 'passport_expiry_date', 'has_nigerian_passport'],
    ['purpose_of_journey', 'travel_carrier', 'flight_number', 'country_of_departure', 'departure_date', 'arrival_date', 'arrival_channel', 'duration_of_stay', 'port_of_entry'],
    ['contact_name', 'contact_phone', 'contact_address', 'contact_city', 'contact_state', 'contact_email', 'postal_code']
  ];

  function textOf(el) { return String(el && (el.innerText || el.textContent || '') || '').trim(); }
  function keysFor(key) { return [norm(key), ...(aliases[key] || [])]; }
  function metadata(el) {
    const out = [el.name, el.id, el.getAttribute?.('formcontrolname'), el.getAttribute?.('placeholder'), el.getAttribute?.('aria-label'), el.getAttribute?.('data-placeholder'), el.getAttribute?.('autocomplete')];
    const labelled = el.getAttribute?.('aria-labelledby');
    if (labelled) labelled.split(/\s+/).forEach(id => { const n = document.getElementById(id); if (n) out.push(textOf(n)); });
    if (el.id) document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`).forEach(l => out.push(textOf(l)));
    const wrappingLabel = el.closest?.('label'); if (wrappingLabel) out.push(textOf(wrappingLabel));
    const group = el.closest?.('mat-form-field,.mat-mdc-form-field,.form-group,.form-field,.field,.mb-3,.row,[class*="form-group"],[class*="field"]');
    if (group) {
      const lab = group.querySelector('label,mat-label,.mat-mdc-floating-label,.control-label,.form-label,[class*="label"]');
      if (lab) out.push(textOf(lab));
    }
    return out.filter(Boolean).map(norm);
  }
  function scoreField(el, key) {
    const wants = keysFor(key), meta = metadata(el); let score = 0;
    for (const m of meta) for (const w of wants) {
      if (m === w) score = Math.max(score, 100);
      else if (m.startsWith(w) || w.startsWith(m)) score = Math.max(score, 80);
      else if (m.includes(w) || w.includes(m)) score = Math.max(score, 60);
    }
    return score;
  }
  function controlSelector() {
    return 'select,input:not([type="hidden"]):not([type="file"]),textarea,[role="combobox"],[aria-haspopup="listbox"],mat-select,ng-select,.ng-select,.mat-select,.mat-mdc-select,.p-dropdown,.p-select,.select2-selection,[class*="react-select"]';
  }
  function candidates() { return [...document.querySelectorAll(controlSelector())].filter(visible); }

  function findNearLabel(key) {
    const wants = keysFor(key);
    const textNodes = [...document.querySelectorAll('label,mat-label,.form-label,.control-label,strong,b,span,div,p')].filter(visible);
    for (const label of textNodes) {
      const n = norm(textOf(label));
      if (!wants.some(w => n === w || n.includes(w))) continue;
      let box = label;
      for (let depth = 0; depth < 6 && box; depth++, box = box.parentElement) {
        const controls = [...box.querySelectorAll(controlSelector())].filter(visible);
        if (controls.length === 1) return controls[0];
        if (controls.length > 1) {
          const lr = label.getBoundingClientRect();
          const below = controls.filter(c => c.getBoundingClientRect().top >= lr.bottom - 4).sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
          if (below.length) return below[0];
        }
      }
    }
    return null;
  }
  function stepOnePositionalFallback(key) {
    const index = { nationality:0, visa_category:1, passport_type:2 }[key]; if (index == null) return null;
    const body = norm(document.body?.innerText || '');
    if (!body.includes('step1generalinformation') && !body.includes('generalinformation')) return null;
    const selects = [...document.querySelectorAll('select')].filter(visible); if (selects[index]) return selects[index];
    const combos = [...document.querySelectorAll('[role="combobox"],[aria-haspopup="listbox"],mat-select,ng-select,.ng-select,.mat-select,.mat-mdc-select,.p-dropdown,.p-select')].filter(visible);
    return combos[index] || null;
  }
  function findControl(key) {
    const ranked = candidates().map(el => [scoreField(el,key),el]).filter(x => x[0] > 0).sort((a,b) => b[0]-a[0]);
    return ranked[0]?.[1] || findNearLabel(key) || stepOnePositionalFallback(key);
  }


  // Page 1 uses a dedicated DOM-only engine. It never calls the native tap bridge
  // and never searches navigation buttons. This prevents a Back/Previous control
  // from ever becoming a field target.
  const pageOneLabels = {
    nationality: ['nationality'],
    visa_category: ['class of visa','visa category','class visa'],
    passport_type: ['passport type','type of passport']
  };

  function pageOneFormRoot() {
    const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,.card-header,.page-title,.form-title')].filter(visible);
    const h=headings.find(x=>/step\s*1|general\s*information/i.test(textOf(x)));
    let node=h;
    for(let d=0; d<8 && node; d++,node=node.parentElement){
      if(node.querySelectorAll && node.querySelectorAll('select,[role="combobox"],mat-select,ng-select,.ng-select,.mat-select,.mat-mdc-select,.p-dropdown,.p-select').length>=3) return node;
    }
    return document.querySelector('form') || document.body;
  }

  function pageOneGroupFor(key) {
    const root=pageOneFormRoot();
    const wants=pageOneLabels[key]||[];
    const labels=[...root.querySelectorAll('label,mat-label,.form-label,.control-label,legend,strong,b,span,div,p')];
    for(const lab of labels){
      const t=String(textOf(lab)).replace(/\s+/g,' ').trim().toLowerCase();
      if(!wants.some(w=>t===w || t.startsWith(w+' ') || t.includes(w))) continue;
      let box=lab;
      for(let d=0; d<7 && box; d++,box=box.parentElement){
        if(!box.querySelectorAll) continue;
        const controls=[...box.querySelectorAll('select,[role="combobox"],mat-select,ng-select,.ng-select,.mat-select,.mat-mdc-select,.p-dropdown,.p-select,input:not([type="button"]):not([type="submit"]):not([type="reset"])')];
        if(controls.length) return box;
      }
    }
    return null;
  }

  function pageOneControl(key) {
    const selectors={
      nationality:'mat-select[name="nationality"]',
      visa_category:'mat-select[name="visaClass"]',
      passport_type:'mat-select[name="passportType"]'
    };
    const exact=selectors[key] ? document.querySelector(selectors[key]) : null;
    if(exact) return exact;
    const idx={nationality:0,visa_category:1,passport_type:2}[key];
    const root=pageOneFormRoot();
    const controls=[...root.querySelectorAll('mat-select,[role="combobox"]')];
    return controls[idx] || null;
  }

  function pageOneOptionText(el){
    if(!el) return '';
    if(el.tagName==='SELECT') return textOf(el.options?.[el.selectedIndex]);
    return el.getAttribute?.('aria-valuetext') || el.getAttribute?.('data-value') || textOf(el);
  }

  function callFrameworkChange(el, value){
    try{
      // React controlled inputs keep a private value tracker. Marking the previous
      // value forces React to observe our dispatched change.
      if(el._valueTracker) el._valueTracker.setValue('__evisa_previous__');
      for(const k of Object.keys(el)){
        if(!k.startsWith('__reactProps$')) continue;
        const props=el[k];
        if(props?.onInput) try{props.onInput({target:el,currentTarget:el,type:'input'});}catch(_){}
        if(props?.onChange) try{props.onChange({target:el,currentTarget:el,type:'change'});}catch(_){}
      }
    }catch(_){}
    try{ el.dispatchEvent(new Event('input',{bubbles:true,composed:true})); }catch(_){}
    try{ el.dispatchEvent(new Event('change',{bubbles:true,composed:true})); }catch(_){}
  }

  function bootstrapSelectWrapper(select){
    if(!select) return null;
    return select.closest?.('.bootstrap-select') ||
      (select.parentElement?.classList?.contains('bootstrap-select') ? select.parentElement : null) ||
      select.parentElement?.querySelector?.('.bootstrap-select') || null;
  }

  function renderBootstrapSelect(select,opt){
    const label=textOf(opt) || String(opt?.textContent || opt?.value || '').trim();
    const wrap=bootstrapSelectWrapper(select);
    const jq=g.jQuery || g.$;
    let pluginUsed=false;
    try{
      if(jq && jq.fn && typeof jq.fn.selectpicker==='function'){
        const $s=jq(select);
        $s.selectpicker('val', opt.value);
        $s.selectpicker('render');
        // refresh is important on the eVisa portal because dependent option lists
        // (especially Class of Visa) are rebuilt after another field changes.
        $s.selectpicker('refresh');
        $s.trigger('change');
        pluginUsed=true;
      }
    }catch(_){ }
    // Bootstrap-select keeps a visible button separate from the real <select>.
    // Keep that button in sync even if the plugin API is unavailable/partially loaded.
    if(wrap){
      const btn=wrap.querySelector('.dropdown-toggle,[data-toggle="dropdown"],[data-bs-toggle="dropdown"]');
      const caption=wrap.querySelector('.filter-option-inner-inner,.filter-option,.selected-text,[class*="filter-option"]');
      if(caption && label) caption.textContent=label;
      if(btn && label){ btn.setAttribute('title',label); btn.setAttribute('aria-label',label); }
      try{ wrap.classList.remove('show','open'); }catch(_){}
    }
    return pluginUsed;
  }

  function selectOptionMatch(el,key,value){
    const wants=valueCandidates(key,value).map(norm);
    const opts=[...el.options];
    let opt=opts.find(o=>wants.includes(norm(o.value))||wants.includes(norm(textOf(o))));
    if(!opt) opt=opts.find(o=>wants.some(w=>norm(textOf(o)).includes(w)||w.includes(norm(textOf(o)))));
    return {opt,wants};
  }

  async function setPageOneNativeSelect(el,key,value){
    const isBootstrap = !!bootstrapSelectWrapper(el) || el.classList?.contains('selectpicker') || el.hasAttribute?.('data-live-search');
    for(let attempt=0; attempt<34; attempt++){
      const {opt,wants}=selectOptionMatch(el,key,value);
      if(opt){
        const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')?.set;
        if(setter) setter.call(el,opt.value); else el.value=opt.value;
        [...el.options].forEach(o=>{ o.selected=(o===opt); });
        callFrameworkChange(el,opt.value);
        if(isBootstrap) renderBootstrapSelect(el,opt);
        // Bootstrap-select and the portal's dependent dropdown code both listen to
        // native change. Send it again after the visible widget has rendered.
        try{ el.dispatchEvent(new Event('change',{bubbles:true,composed:true})); }catch(_){}
        await sleep(key==='nationality' ? 700 : 300);
        const selected=el.options?.[el.selectedIndex];
        const have=[norm(el.value),norm(textOf(selected)),norm(bootstrapSelectWrapper(el)?.querySelector?.('.filter-option-inner-inner,.filter-option')?.textContent||'')].filter(Boolean);
        if(have.some(h=>wants.some(w=>h===w||h.includes(w)||w.includes(h)))){
          el.dataset.evisaFilled=norm(value);
          report(`Page 1 ${key.replace(/_/g,' ')} selected through ${isBootstrap?'Bootstrap dropdown API':'native select API'}.`,{step:1,field:key,method:isBootstrap?'bootstrap-select':'native-select'});
          return true;
        }
      }
      await sleep(180);
    }
    report(`Page 1: option not found for ${key.replace(/_/g,' ')}: ${value}`,{step:1,field:key,controlTag:el.tagName,optionCount:el.options?.length||0,bootstrap:!!bootstrapSelectWrapper(el)});
    return false;
  }

  async function setPageOneCustom(el,key,value){
    const group=pageOneGroupFor(key) || el.parentElement || el;
    const hiddenSelect=group.querySelector?.('select');
    if(hiddenSelect) return setPageOneNativeSelect(hiddenSelect,key,value);
    const wants=valueCandidates(key,value).map(norm);

    // Some custom libraries keep all options in the DOM even while the popup is closed.
    const all=[...document.querySelectorAll('[role="option"],mat-option,.mat-option,.mat-mdc-option,.ng-option,.p-dropdown-item,.p-select-option,li[role="option"],option')];
    let opt=all.find(o=>wants.includes(norm(o.getAttribute?.('value')||''))||wants.includes(norm(textOf(o))));
    if(!opt) opt=all.find(o=>wants.some(w=>norm(textOf(o)).includes(w)||w.includes(norm(textOf(o)))));
    if(opt && opt.tagName!=='OPTION'){
      try{ opt.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true})); opt.click(); opt.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true})); }catch(_){}
      await sleep(250);
      const have=norm(pageOneOptionText(el));
      if(wants.some(w=>have===w||have.includes(w)||w.includes(have))){ el.dataset.evisaFilled=norm(value); return true; }
    }

    // Last DOM-only fallback: update the form-associated input kept inside the custom control.
    const backing=group.querySelector?.('input[name],input[formcontrolname]');
    if(backing){
      const raw=valueCandidates(key,value)[0]||String(value);
      try{ nativeSetValue(backing,raw); callFrameworkChange(backing,raw); await sleep(180); }catch(_){}
      const have=norm(backing.value||pageOneOptionText(el));
      if(have) { el.dataset.evisaFilled=norm(value); return true; }
    }
    report(`Page 1: custom dropdown could not be set without a physical tap: ${key.replace(/_/g,' ')}`,{step:1,field:key,controlTag:el.tagName,className:String(el.className||'')});
    return false;
  }

  function pageOneTrigger(key, el){
    const group=pageOneGroupFor(key);
    if(!group) return null;
    const wrap=(el?.tagName==='SELECT' ? bootstrapSelectWrapper(el) : null) ||
      group.querySelector('.bootstrap-select,.dropdown.bootstrap-select,.select2-container,.ng-select,.p-dropdown,.p-select');
    const possible=[
      wrap?.querySelector?.('button.dropdown-toggle,[data-toggle="dropdown"],[data-bs-toggle="dropdown"],[role="combobox"]'),
      group.querySelector('button.dropdown-toggle,[data-toggle="dropdown"],[data-bs-toggle="dropdown"],[role="combobox"],.select2-selection,.ng-select-container,.p-dropdown,.p-select')
    ].filter(Boolean);
    return possible.find(x=>visible(x) && group.contains(x) && !/(back|previous|cancel|continue|next)/i.test(textOf(x))) || null;
  }

  function pageOneSearchInput(group){
    const scoped=[
      group?.querySelector?.('.bootstrap-select.show .bs-searchbox input,.bootstrap-select.open .bs-searchbox input,.bs-searchbox input,.dropdown-menu.show input[type="search"],.dropdown-menu.show input[type="text"]'),
      document.querySelector('.bootstrap-select.show .bs-searchbox input,.bootstrap-select.open .bs-searchbox input,.dropdown-menu.show .bs-searchbox input,.dropdown-menu.show input[type="search"]'),
      [...document.querySelectorAll('input[type="search"],input.form-control')].find(x=>visible(x) && /search/i.test(x.placeholder||x.getAttribute('aria-label')||''))
    ].filter(Boolean);
    return scoped.find(visible) || null;
  }

  function pageOneVisibleOptions(){
    const selectors=[
      '.bootstrap-select.show .dropdown-menu li a',
      '.bootstrap-select.open .dropdown-menu li a',
      '.dropdown-menu.show li a',
      '.dropdown-menu.show .dropdown-item',
      '.select2-results__option',
      '[role="listbox"] [role="option"]',
      '.ng-dropdown-panel .ng-option',
      '.p-dropdown-panel .p-dropdown-item',
      '.p-select-overlay .p-select-option'
    ].join(',');
    return [...document.querySelectorAll(selectors)].filter(x=>visible(x) && !/(back|previous|cancel|continue|next)/i.test(textOf(x)));
  }

  async function setPageOneTrusted(key,value,el){
    const group=pageOneGroupFor(key);
    const trigger=pageOneTrigger(key,el);
    if(!group || !trigger){
      report(`Page 1 trusted activation unavailable for ${key.replace(/_/g,' ')}`,{step:1,field:key});
      return false;
    }
    report(`Page 1 activating ${key.replace(/_/g,' ')} automatically…`,{step:1,field:key,method:'trusted-webview-tap'});
    if(!await nativeTapElement(trigger,420)) return false;
    await sleep(180);
    const wants=valueCandidates(key,value).map(norm);
    const search=pageOneSearchInput(group);
    if(search){
      const query=String(valueCandidates(key,value)[0]||value);
      try{ search.focus(); nativeSetValue(search,query); fire(search); }catch(_){ }
      await sleep(260);
    }
    for(let attempt=0; attempt<18; attempt++){
      const opts=pageOneVisibleOptions();
      let opt=opts.find(o=>wants.includes(norm(o.getAttribute?.('data-original-index')||'')) || wants.includes(norm(o.getAttribute?.('data-value')||'')) || wants.includes(norm(textOf(o))));
      if(!opt) opt=opts.find(o=>wants.some(w=>{const t=norm(textOf(o)); return t===w||t.includes(w)||w.includes(t);}));
      if(opt){
        if(!await nativeTapElement(opt,380)) return false;
        await sleep(key==='nationality'?850:420);
        if(pageOneValueConfirmed(key,value)){
          const target=pageOneControl(key); if(target) target.dataset.evisaFilled=norm(value);
          report(`Page 1 ${key.replace(/_/g,' ')} confirmed after trusted dropdown selection.`,{step:1,field:key,method:'trusted-option'});
          return true;
        }
      }
      await sleep(160);
    }
    // Close the popup without touching any navigation element.
    try{ document.activeElement?.blur?.(); }catch(_){ }
    report(`Page 1 could not confirm ${key.replace(/_/g,' ')} after automatic dropdown activation.`,{step:1,field:key});
    return false;
  }

  async function setPageOneField(key,value){
    let el=pageOneControl(key);
    if(!el){ report(`Page 1: ${key.replace(/_/g,' ')} dropdown not found.`,{step:1,field:key}); return false; }
    report(`Page 1 target ${key.replace(/_/g,' ')} → ${el.tagName.toLowerCase()}`,{step:1,field:key,controlTag:el.tagName});
    let ok=false;
    if(el.tagName==='SELECT') ok=await setPageOneNativeSelect(el,key,value);
    else ok=await setPageOneCustom(el,key,value);
    if(ok && pageOneValueConfirmed(key,value)) return true;
    // The portal's visible bootstrap widget may ignore programmatic changes until it
    // receives a trusted activation. Do that automatically and strictly inside this field.
    el=pageOneControl(key) || el;
    return await setPageOneTrusted(key,value,el);
  }

  function valueCandidates(key, value) {
    const raw = String(value || '').trim(); const out = [raw];
    if (key === 'visa_category' && raw.includes(' - ')) { const [code,...rest] = raw.split(' - '); out.push(code, rest.join(' - ')); }
    if (key === 'passport_type' && norm(raw) === 'standard') out.push('Standard Passport','Ordinary Passport','Ordinary');
    if (key === 'has_nigerian_passport') {
      if (['no','false','0'].includes(norm(raw))) out.push('No','NO','False');
      if (['yes','true','1'].includes(norm(raw))) out.push('Yes','YES','True');
    }
    if (key === 'port_of_entry') {
      if (/lagos/i.test(raw)) out.push('Lagos'); if (/abuja/i.test(raw)) out.push('Abuja'); if (/kano/i.test(raw)) out.push('Kano');
      if (/enugu/i.test(raw)) out.push('Enugu'); if (/port\s*harcourt/i.test(raw)) out.push('Port Harcourt');
    }
    return [...new Set(out.filter(Boolean))];
  }

  function nativeSetValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
  }
  function fire(el) {
    try { el.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:String(el.value ?? '') })); } catch (_) { el.dispatchEvent(new Event('input',{bubbles:true})); }
    el.dispatchEvent(new Event('change',{bubbles:true}));
    try { el.dispatchEvent(new Event('blur',{bubbles:true})); } catch (_) {}
  }
  function normalizeDate(value, inputType) {
    const v = String(value || '').trim(); const m = v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!m) return v;
    return inputType === 'date' ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`;
  }
  function setText(el, value) {
    const v = (el.type === 'date' || /date/i.test(el.getAttribute?.('type') || '')) ? normalizeDate(value,'date') : (['date_of_birth','passport_expiry_date','departure_date','arrival_date'].some(k => scoreField(el,k)>0) ? normalizeDate(value,'text') : String(value));
    try { el.scrollIntoView({block:'center'}); el.focus(); } catch (_) {}
    nativeSetValue(el,v); fire(el); el.dataset.evisaFilled = norm(value); return true;
  }

  async function nativeTapElement(el, wait = 300) {
    if (!el || !visible(el)) return false;
    try { el.scrollIntoView({block:'center', inline:'nearest'}); } catch (_) {}
    await sleep(80);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    if (!g.EVisaPortalNative?.tap) {
      try { dispatchActivationEvents(el); el.click?.(); await sleep(wait); return true; } catch (_) { return false; }
    }
    const nx = Math.max(0.001, Math.min(0.999, (r.left + r.width/2) / Math.max(1, innerWidth)));
    const ny = Math.max(0.001, Math.min(0.999, (r.top + r.height/2) / Math.max(1, innerHeight)));
    try { g.EVisaPortalNative.tap(nx,ny); await sleep(wait); return true; } catch (_) { return false; }
  }

  function belongsToControl(hit, el) {
    if (!hit || !el) return false;
    if (hit === el || el.contains?.(hit) || hit.contains?.(el)) return true;
    const wrap = el.closest?.('mat-form-field,.mat-mdc-form-field,.form-group,.form-field,.field,.ng-select,.p-dropdown,.p-select,[class*="select"]');
    return !!(wrap && (hit === wrap || wrap.contains?.(hit)));
  }

  function dispatchActivationEvents(el) {
    try {
      const init={bubbles:true,cancelable:true,view:window};
      el.dispatchEvent(new PointerEvent('pointerdown', {...init,pointerId:1,pointerType:'touch',isPrimary:true}));
      el.dispatchEvent(new MouseEvent('mousedown', init));
      el.focus?.();
      el.dispatchEvent(new PointerEvent('pointerup', {...init,pointerId:1,pointerType:'touch',isPrimary:true}));
      el.dispatchEvent(new MouseEvent('mouseup', init));
      el.dispatchEvent(new MouseEvent('click', init));
    } catch (_) { try { el.focus?.(); el.click?.(); } catch (_) {} }
  }

  async function safeTapControl(el, wait=320) {
    if (!el || !visible(el)) return false;
    if (!g.EVisaPortalNative?.tap) { try { dispatchActivationEvents(el); el.click?.(); await sleep(wait); return true; } catch (_) { return false; } }
    try { el.scrollIntoView({block:'center',inline:'nearest'}); } catch (_) {}
    await sleep(140);
    const r=el.getBoundingClientRect();
    if(!r.width||!r.height) return false;
    const points=[
      [r.left+r.width*0.50,r.top+r.height*0.50],
      [r.left+r.width*0.75,r.top+r.height*0.50],
      [r.left+r.width*0.25,r.top+r.height*0.50]
    ];
    for(const [x,y] of points){
      if(x<0||y<0||x>innerWidth||y>innerHeight) continue;
      const hit=document.elementFromPoint(x,y);
      const hitText=norm(textOf(hit));
      if(/previous|back|cancel/.test(hitText)) continue;
      if(!belongsToControl(hit,el)) continue;
      const nx=Math.max(0.001,Math.min(0.999,x/Math.max(1,innerWidth)));
      const ny=Math.max(0.001,Math.min(0.999,y/Math.max(1,innerHeight)));
      try { g.EVisaPortalNative.tap(nx,ny); await sleep(wait); return true; } catch (_) {}
    }
    report('Safety guard blocked a dropdown tap because the WebView hit point was not inside the field.',{fieldGuard:true});
    return false;
  }

  async function setNativeSelect(el,key,value) {
    const isBootstrap = !!bootstrapSelectWrapper(el) || el.classList?.contains('selectpicker') || el.hasAttribute?.('data-live-search');
    for (let attempt=0; attempt<24; attempt++) {
      const {opt,wants}=selectOptionMatch(el,key,value);
      if (opt) {
        try { el.focus(); } catch (_) {}
        nativeSetValue(el,opt.value); [...el.options].forEach(o=>{o.selected=(o===opt);}); fire(el);
        if(isBootstrap) renderBootstrapSelect(el,opt);
        await sleep(220);
        const selected=el.options?.[el.selectedIndex];
        if(norm(el.value)===norm(opt.value) || norm(textOf(selected))===norm(textOf(opt))){ el.dataset.evisaFilled = norm(value); return true; }
      }
      await sleep(180);
    }
    report(`No option match for ${key.replace(/_/g,' ')}: ${value}`,{field:key,bootstrap:isBootstrap}); return false;
  }
  function optionNodes() {
    return [...document.querySelectorAll('[role="option"],mat-option,.mat-option,.mat-mdc-option,.ng-option,.p-dropdown-item,.p-select-option,.select2-results__option,li[role="option"],.dropdown-menu .dropdown-item,.cdk-overlay-container li,.cdk-overlay-container [class*="option"],[class*="dropdown"] [class*="option"]')].filter(visible);
  }
  async function selectCustom(el,key,value) {
    const wants = valueCandidates(key,value).map(norm);
    // Important: native Android touch creates a trusted gesture. Synthetic JS click does not.
    dispatchActivationEvents(el);
    await sleep(180);
    if (!optionNodes().length) await safeTapControl(el,420);
    for (let attempt=0; attempt<16; attempt++) {
      const opts = optionNodes();
      let opt = opts.find(o => wants.includes(norm(textOf(o))) || wants.includes(norm(o.getAttribute?.('data-value') || '')));
      if (!opt) opt = opts.find(o => wants.some(w => norm(textOf(o)).includes(w) || w.includes(norm(textOf(o)))));
      if (opt) {
        await nativeTapElement(opt,260);
        el.dataset.evisaFilled = norm(value); return true;
      }
      await sleep(120);
    }
    return false;
  }

  function radioLabelText(input) {
    const out = [input.value, input.getAttribute?.('aria-label')];
    if (input.id) document.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`).forEach(l => out.push(textOf(l)));
    const lab = input.closest?.('label'); if (lab) out.push(textOf(lab));
    return norm(out.filter(Boolean).join(' '));
  }
  function findQuestionContainer(key) {
    const wants = keysFor(key);
    const nodes = [...document.querySelectorAll('label,legend,strong,b,p,span,div')].filter(visible);
    for (const n of nodes) {
      const t = norm(textOf(n)); if (!wants.some(w => t.includes(w))) continue;
      let box=n; for(let d=0; d<6 && box; d++,box=box.parentElement) {
        if (box.querySelectorAll('input[type="radio"],input[type="checkbox"]').length) return box;
      }
    }
    return null;
  }
  async function setRadioQuestion(key,value) {
    const box = findQuestionContainer(key) || document;
    const radios = [...box.querySelectorAll('input[type="radio"],input[type="checkbox"]')].filter(r => r.isConnected);
    if (!radios.length) return false;
    const wants = valueCandidates(key,value).map(norm);
    let target = radios.find(r => wants.includes(norm(r.value)) || wants.some(w => radioLabelText(r).includes(w)));
    if (!target && ['yes','true','1'].includes(norm(value))) target = radios[0];
    if (!target && ['no','false','0'].includes(norm(value))) target = radios[1] || radios[0];
    if (!target) return false;
    const label = target.id ? document.querySelector(`label[for="${CSS.escape(target.id)}"]`) : target.closest?.('label');
    await nativeTapElement(visible(target) ? target : label,220);
    if (!target.checked) { try { target.checked=true; target.dispatchEvent(new Event('change',{bubbles:true})); } catch (_) {} }
    target.dataset.evisaFilled = norm(value); return true;
  }

  function splitPortalDate(value){
    const s=String(value??'').trim();
    if(!s) return null;
    // Supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD and compact DDMMYYYY.
    let m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if(m) return {day:m[1].padStart(2,'0'),month:m[2].padStart(2,'0'),year:m[3]};
    m=s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
    if(m) return {day:m[3].padStart(2,'0'),month:m[2].padStart(2,'0'),year:m[1]};
    const digits=s.replace(/\D/g,'');
    if(digits.length===8){
      // Applicant data used by this project stores dates as DDMMYYYY.
      return {day:digits.slice(0,2),month:digits.slice(2,4),year:digits.slice(4,8)};
    }
    return null;
  }

  async function setPageTwoDateOfBirth(value){
    const parts=splitPortalDate(value);
    if(!parts){ report(`Could not parse date of birth: ${value}`,{step:2,field:'date_of_birth'}); return false; }

    const day=document.querySelector('form[name="personalDetailsForm"] input[name="dateOfBirthDay"],input[name="dateOfBirthDay"]');
    const month=document.querySelector('form[name="personalDetailsForm"] select[name="dateOfBirthMonth"],select[name="dateOfBirthMonth"]');
    const year=document.querySelector('form[name="personalDetailsForm"] input[name="dateOfBirthYear"],input[name="dateOfBirthYear"]');
    if(!day || !month || !year){
      report('Page 2 DOB controls were not found.',{step:2,field:'date_of_birth'});
      return false;
    }

    // The portal uses THREE separate controls. Never put the full date in the DD box.
    nativeSetValue(day,parts.day); fire(day);
    day.dataset.evisaFilled=norm(parts.day);
    await sleep(80);

    const opt=[...month.options].find(o=>String(o.value).padStart(2,'0')===parts.month);
    if(!opt){
      report(`Page 2 DOB month ${parts.month} is not available.`,{step:2,field:'date_of_birth'});
      return false;
    }
    nativeSetValue(month,opt.value);
    [...month.options].forEach(o=>o.selected=(o===opt));
    fire(month);
    month.dataset.evisaFilled=norm(parts.month);
    await sleep(80);

    nativeSetValue(year,parts.year); fire(year);
    year.dataset.evisaFilled=norm(parts.year);
    await sleep(120);

    const ok=String(day.value).padStart(2,'0')===parts.day &&
      String(month.value).padStart(2,'0')===parts.month &&
      String(year.value)===parts.year;
    if(ok) report(`Page 2 date of birth filled as ${parts.day}/${parts.month}/${parts.year}.`,{step:2,field:'date_of_birth',method:'three-part-dob'});
    return ok;
  }

  async function setControl(el,key,value) {
    if (!el || value == null || String(value).trim()==='') return false;
    if (key === 'has_nigerian_passport') {
      const radioDone = await setRadioQuestion(key,value); if (radioDone) return true;
    }
    if (el.tagName === 'SELECT') return setNativeSelect(el,key,value);
    if (el.matches('input,textarea') && !['radio','checkbox','button','submit'].includes((el.type||'').toLowerCase())) return setText(el,value);
    if (el.type === 'radio' || el.type === 'checkbox') return setRadioQuestion(key,value);
    return selectCustom(el,key,value);
  }

  function mimeForName(name) {
    const n=String(name||'').toLowerCase();
    if(n.endsWith('.pdf')) return 'application/pdf';
    if(n.endsWith('.png')) return 'image/png';
    return 'image/jpeg';
  }
  async function requestAssignedFile(name) {
    if(!name) return null;
    try {
      const reply=await chrome.runtime.sendMessage({type:'EVISA_GET_DOCUMENT',filename:name});
      if(!reply?.ok || !reply.base64) throw new Error(reply?.error||'Document download failed');
      const raw=atob(reply.base64); const bytes=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
      return new File([bytes], reply.name||name, {type:reply.mime||mimeForName(name)});
    } catch(e) { report(`Could not download assigned document ${name}: ${e?.message||e}`,{file:name,error:String(e)}); return null; }
  }
  async function putFileIntoInput(input,name) {
    const file=await requestAssignedFile(name); if(!file||!input) return false;
    try {
      const dt=new DataTransfer(); dt.items.add(file); input.files=dt.files;
      input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
      await sleep(350); return !!input.files?.length;
    } catch(e) { report(`Portal file input rejected ${name}: ${e?.message||e}`,{file:name,error:String(e)}); return false; }
  }

  function photoAssignment(app) {
    const visa = String(app?.visa_category || '').toUpperCase();
    let pos = 0;
    if (visa.startsWith('F4A') || visa.startsWith('F4B')) pos=3;
    else if (visa.startsWith('F5A')) pos=2;
    else if (visa.startsWith('F6A')) pos=4;
    if (pos && app[`upload_position_${pos}`]) return {uri:app[`upload_position_${pos}`], name:app[`upload_position_${pos}_name`] || 'passport-photo'};
    for(let p=1;p<=7;p++) {
      const name=String(app?.[`upload_position_${p}_name`] || '');
      if (/photo|photograph|passport.?photo/i.test(name) && app?.[`upload_position_${p}`]) return {uri:app[`upload_position_${p}`],name};
    }
    return null;
  }
  function findPhotoUploadActivator() {
    const files=[...document.querySelectorAll('input[type="file"]')];
    for(const input of files) {
      if (visible(input)) return input;
      if (input.id) { const l=document.querySelector(`label[for="${CSS.escape(input.id)}"]`); if (visible(l)) return l; }
      const box=input.parentElement;
      if(box){ const target=[...box.querySelectorAll('button,label,a,[role="button"],span,div')].find(n=>visible(n)&&/photo|photograph|upload|choose|browse/i.test(textOf(n))); if(target)return target; }
    }
    const textTarget=[...document.querySelectorAll('button,label,a,[role="button"],span,div')].find(n=>visible(n)&&/upload.*photo|photo.*upload|passport.*photo|photograph/i.test(textOf(n)));
    return textTarget || null;
  }
  async function autoPassportPhoto() {
    const photo=photoAssignment(currentApplicant);
    if(!photo) {
      report('Page 2: no passport photograph is assigned to this applicant.',{step:2,field:'passport_photo'});
      return false;
    }

    // If a real photo is already displayed, do not reopen the upload dialog.
    const currentImg=document.querySelector('form[name="personalDetailsForm"] .img_upload img.cropped, .img_upload img.cropped');
    const currentSrc=String(currentImg?.getAttribute('src')||'');
    if(currentImg && currentSrc && !/defaultImage\.png/i.test(currentSrc)){
      report('Page 2 passport photograph is already present.',{step:2,field:'passport_photo'});
      return true;
    }

    report(`Page 2 opening passport photo uploader for ${photo.name||photo.uri}…`,{step:2,field:'passport_photo'});

    // The live portal does NOT render the file input until the applicant clicks
    // the camera/photo box first.
    let activator=
      document.querySelector('form[name="personalDetailsForm"] .img_upload .icon_image') ||
      document.querySelector('form[name="personalDetailsForm"] .img_upload .img_box') ||
      document.querySelector('.img_upload .icon_image') ||
      document.querySelector('.img_upload .img_box') ||
      document.querySelector('.img_upload img.cropped');

    if(!activator){
      report('Page 2: passport photo/camera box was not found.',{step:2,field:'passport_photo'});
      return false;
    }

    try{
      activator.scrollIntoView({block:'center',inline:'nearest'});
      dispatchActivationEvents(activator);
      activator.click?.();
    }catch(e){
      report(`Page 2: could not open passport photo uploader: ${e?.message||e}`,{step:2,field:'passport_photo'});
      return false;
    }

    // Wait for the upload modal created after clicking the camera box.
    const input=await waitFor(()=>{
      const selectors=[
        'app-file-upload-modal input[type="file"]',
        '.modal input[type="file"]',
        '[role="dialog"] input[type="file"]',
        'input[type="file"][accept*="image"]'
      ];
      for(const sel of selectors){
        const n=document.querySelector(sel);
        if(n) return n;
      }
      return null;
    },12000,120);

    if(!input){
      report('Page 2: Upload File modal opened but its file input was not found.',{step:2,field:'passport_photo'});
      return false;
    }

    report('Page 2 passport photo file input detected — attaching Railway photograph…',{step:2,field:'passport_photo'});
    const attached=await putFileIntoInput(input,photo.uri);
    if(!attached){
      report('Page 2: portal rejected the passport photograph file.',{step:2,field:'passport_photo'});
      return false;
    }

    // Give Angular/cropper time to render the preview.
    await sleep(700);

    const okButton=await waitFor(()=>{
      const root=document.querySelector('app-file-upload-modal') ||
                 document.querySelector('[role="dialog"]') ||
                 document.querySelector('.modal');
      const buttons=[...(root||document).querySelectorAll('button,input[type="button"],input[type="submit"]')];
      return buttons.find(b=>visible(b) && /^(ok|apply|save|done)$/i.test(String(b.value||textOf(b)).trim())) || null;
    },12000,150);

    if(!okButton){
      report('Page 2: photograph loaded, but the modal OK button was not found.',{step:2,field:'passport_photo'});
      return false;
    }

    report('Page 2 photograph preview loaded — confirming upload…',{step:2,field:'passport_photo'});
    try{
      okButton.scrollIntoView({block:'center'});
      dispatchActivationEvents(okButton);
      okButton.click?.();
    }catch(e){
      report(`Page 2: could not click photograph OK button: ${e?.message||e}`,{step:2,field:'passport_photo'});
      return false;
    }

    // Wait for modal to disappear and/or the default placeholder image to change.
    const applied=await waitFor(()=>{
      const modal=document.querySelector('app-file-upload-modal,[role="dialog"]');
      const img=document.querySelector('form[name="personalDetailsForm"] .img_upload img.cropped, .img_upload img.cropped');
      const src=String(img?.getAttribute('src')||'');
      if(img && src && !/defaultImage\.png/i.test(src)) return true;
      if(!modal && img) return true;
      return false;
    },12000,180);

    if(applied){
      report('Page 2 passport photograph uploaded and confirmed.',{step:2,field:'passport_photo',method:'camera-modal-file-ok'});
      return true;
    }

    report('Page 2: photograph was attached but the portal did not confirm it after OK.',{step:2,field:'passport_photo'});
    return false;
  }

  async function waitFor(fn, timeout=10000, interval=120) {
    const until=Date.now()+timeout;
    while(Date.now()<until){ try{ const v=fn(); if(v) return v; }catch(_){} await sleep(interval); }
    return null;
  }

  async function runSupportingDocuments() {
    const assignments=[]; for(let i=1;i<=7;i++) assignments.push(currentApplicant?.[`upload_position_${i}`]||'');
    const cards=[...document.querySelectorAll('form#msform .upload_docs, .grid-third-box .upload_docs')];
    if(!cards.length) { report('Page 5: supporting-document cards were not found.',{step:5,error:true}); return false; }
    report(`Page 5: ${cards.length} document card(s) detected.`,{step:5});
    for(let i=0;i<Math.min(cards.length,assignments.length);i++){
      const name=assignments[i]; if(!name) continue;
      const card=cards[i];
      const label=String(card.querySelector('.label_doc,label')?.textContent||`Position ${i+1}`).replace(/\s+/g,' ').trim();
      let outer=card.querySelector('input.upload_btn[type="button"][value="Upload file"],input[type="button"][value="Upload file"]');
      if(!outer){ report(`Page 5 position ${i+1} already uploaded or has no Upload file button — ${label}`,{step:5,position:i+1}); continue; }
      report(`Page 5 position ${i+1}: ${label} — ${name}`,{step:5,position:i+1,file:name});
      try{ outer.scrollIntoView({block:'center'}); outer.click(); }catch(e){ report(`Could not click Upload file at position ${i+1}.`,{step:5,position:i+1,error:String(e)}); return false; }
      const input=await waitFor(()=>document.querySelector('div[role="dialog"].in app-file-upload-modal input[type="file"].upload.up, app-file-upload-modal input[type="file"].upload.up'),10000);
      if(!input){ report(`Page 5 position ${i+1}: Upload File dialog input did not appear.`,{step:5,position:i+1,error:true}); return false; }
      const attached=await putFileIntoInput(input,name);
      if(!attached){ report(`Page 5 position ${i+1}: file could not be attached.`,{step:5,position:i+1,file:name,error:true}); return false; }
      const okBtn=await waitFor(()=>[...document.querySelectorAll('app-file-upload-modal .modal-footer button.btn, div[role="dialog"] .modal-footer button')].find(b=>/^ok$/i.test(textOf(b))),3000);
      if(!okBtn){ report(`Page 5 position ${i+1}: OK button was not found.`,{step:5,position:i+1,error:true}); return false; }
      okBtn.click();
      const closed=await waitFor(()=>!document.querySelector('app-file-upload-modal'),10000);
      if(!closed){ report(`Page 5 position ${i+1}: upload dialog did not close after OK.`,{step:5,position:i+1,error:true}); return false; }
      await sleep(650);
    }
    const cont=findNextButton();
    if(cont && !cont.disabled){ report('Page 5 documents complete — opening next page.',{step:5,action:'auto-next'}); cont.click(); return true; }
    report('Page 5 documents processed, but Continue is not enabled yet.',{step:5,error:true}); return false;
  }

  function clickById(id) {
    const el=document.getElementById(id); if(!el) return false;
    try { el.scrollIntoView({block:'center'}); if('checked' in el) el.checked=true; el.click(); el.dispatchEvent(new Event('change',{bubbles:true})); return true; } catch(_) { return false; }
  }
  async function runSimpleRadioPage(step) {
    const ids=step===6?['visaNo','travelNo','refusedNo','visaRefusedNo','deportedNo','travelledAbroadNo']:
      step===7?['convictionsNo','chargesNo','terrorismNo','viewsNo']:['portOfEntry'];
    let done=0; for(const id of ids){ if(clickById(id)) done++; await sleep(100); }
    report(`Page ${step}: selected ${done}/${ids.length} saved/default answer(s).`,{step,filled:done});
    const cont=findNextButton(); if(!cont){ report(`Page ${step}: Continue button not found.`,{step,error:true}); return false; }
    cont.click(); await sleep(900);
    if(step===8){ try{ chrome.runtime.sendMessage({type:'EVISA_JOB_COMPLETE'}); }catch(_){} }
    return true;
  }

  const stepNames = {
    1:'General Information', 2:'Biodata', 3:'Travel Information', 4:'Contact/Hotel Details in Nigeria',
    5:'Supporting Documents', 6:'Travel History', 7:'Security and Criminal History', 8:'Biometric Information'
  };

  function detectStep() {
    // Primary: the form heading itself (e.g. “Step 2: Biodata”). This avoids
    // falsely detecting Step 1 from the progress bar, which contains all 1–8 labels.
    const candidates=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,.card-header,.panel-heading,.form-title,.page-title,legend,strong,b')];
    for(const el of candidates){
      if(!visible(el)) continue;
      const t=String(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
      const m=t.match(/\bstep\s*([1-8])\s*[:.\-]/i);
      if(m) return Number(m[1]);
    }
    const bodyText=String(document.body?.innerText||'').replace(/\s+/g,' ');
    const headingMatch=bodyText.match(/\bStep\s*([1-8])\s*:\s*(General Information|Biodata|Travel Information|Contact|Hotel|Supporting|Reporting|Documents|Travel History|Security|Criminal|Biometric)/i);
    if(headingMatch) return Number(headingMatch[1]);

    // Secondary: active/current step marker used by many progress components.
    const active=[...document.querySelectorAll('.active,.current,[aria-current="step"],[aria-selected="true"]')].filter(visible);
    for(const el of active){
      const t=String(el.innerText||el.textContent||el.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
      const m=t.match(/(?:step\s*)?([1-8])(?:\D|$)/i);
      if(m && /(general|biodata|travel|contact|hotel|support|report|document|history|security|criminal|biometric|step)/i.test(t)) return Number(m[1]);
    }

    // Last resort: controls unique to the first four data-entry pages.
    if(findControl('nationality')&&findControl('visa_category'))return 1;
    if(findControl('surname')&&findControl('passport_number'))return 2;
    if(findControl('purpose_of_journey')||findControl('arrival_channel'))return 3;
    if(findControl('contact_phone')||findControl('contact_address'))return 4;
    return 0;
  }

  let detectorTimer=null, detectorObserver=null, lastDetectedStep=-1;
  function publishDetectedStep(force=false){
    const step=detectStep();
    if(!force && step===lastDetectedStep) return step;
    lastDetectedStep=step;
    if(step){
      report(`Detected Page ${step} — ${stepNames[step]||'eVisa step'}`,{step,pageDetected:true,autoMode});
      scheduleAutoStep(step);
    } else {
      report('eVisa application page not detected yet — waiting.',{step:0,pageDetected:false,autoMode});
    }
    return step;
  }
  function currentPageToken(step){
    const h=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,.card-header,.panel-heading,.form-title,.page-title,legend')]
      .filter(visible).map(textOf).find(t=>new RegExp(`step\\s*${step}\\b`,'i').test(t)) || '';
    return `${location.pathname}|${location.search}|${step}|${norm(h)}`;
  }

  function scheduleAutoStep(step, force=false){
    if(!autoMode || stopped || !currentApplicant || !step || busy) return;
    const token=currentPageToken(step);
    if(!force && token===autoPageToken && autoRetryCount>=3) return;
    clearTimeout(autoTimer);
    autoTimer=setTimeout(async()=>{
      if(!autoMode || stopped || busy || detectStep()!==step) return;
      const now=currentPageToken(step);
      if(now!==autoPageToken){ autoPageToken=now; autoRetryCount=0; }
      autoRetryCount++;
      report(`Page ${step} detected — running automatically (${autoRetryCount}/3)…`,{step,auto:true});
      const ok=await fillCurrentPage(true,true);
      if(!ok && autoRetryCount<3) setTimeout(()=>scheduleAutoStep(step,true),650);
    }, step===1?500:350);
  }

  function startDetector(){
    if(detectorTimer) clearInterval(detectorTimer);
    if(detectorObserver) try{detectorObserver.disconnect();}catch(_){}
    publishDetectedStep(true);
    detectorTimer=setInterval(()=>publishDetectedStep(false),1000);
    detectorObserver=new MutationObserver(()=>{ clearTimeout(g.__evisaDetectDebounce); g.__evisaDetectDebounce=setTimeout(()=>publishDetectedStep(false),180); });
    try{detectorObserver.observe(document.documentElement||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-current','aria-selected']});}catch(_){}
    return true;
  }

  function pageOneValueConfirmed(key,value){
    const el=pageOneControl(key); if(!el) return false;
    const visibleValue=(el.querySelector('.mat-select-min-line')?.textContent || '').trim();
    const have=norm(visibleValue);
    if(!have || have==='chooseoption' || have==='selectoption') return false;

    const wants=valueCandidates(key,value).map(norm).filter(Boolean);
    if(wants.some(w=>have===w || have.includes(w) || w.includes(have))) return true;

    if(key==='visa_category'){
      const a=(String(value||'').match(/\bF\d+[A-Z]?\b/i)||[])[0];
      const b=(visibleValue.match(/\bF\d+[A-Z]?\b/i)||[])[0];
      if(a && b && norm(a)===norm(b)) return true;
    }
    if(key==='passport_type'){
      const want=norm(value);
      if((want.includes('standard')||want.includes('ordinary')) &&
         (have.includes('standard')||have.includes('ordinary'))) return true;
    }
    return false;
  }

  function pageOneAllConfirmed(){
    if(detectStep()!==1 || !currentApplicant) return false;
    return ['nationality','visa_category','passport_type'].every(k=>{
      const v=currentApplicant[k]; return v==null||String(v).trim()==='' ? false : pageOneValueConfirmed(k,v);
    });
  }

  function findNextButton() {
    const nodes = [...document.querySelectorAll('button,input[type="submit"],input[type="button"],a[role="button"],a.btn,[role="button"]')].filter(visible);
    const good = /^(continue|next|saveandcontinue|proceed|continueapplication)$/i;
    const bad = /(back|previous|cancel|submitapplication|finalsubmit|payment|paynow|biometric|completeapplication|finish)/i;
    return nodes.find(el => {
      const raw = String(el.value || textOf(el) || el.getAttribute?.('aria-label') || '').trim();
      const n = norm(raw);
      if (!n || bad.test(n)) return false;
      return good.test(n) || n.includes('continue') || (n === 'next');
    }) || null;
  }

  function visibleValidationMessages() {
    const sel = '.invalid-feedback,.validation-error,.field-validation-error,.text-danger,.alert-danger,.alert-error,[role="alert"],[aria-live="assertive"]';
    return [...document.querySelectorAll(sel)].filter(visible).map(textOf).filter(Boolean).filter(t => !/copyright|warning/i.test(t));
  }

  function requiredUnfilledControls() {
    const required = [...document.querySelectorAll('input[required],select[required],textarea[required],[aria-required="true"]')];
    return required.filter(el => {
      if (!el.isConnected || el.disabled) return false;
      const type = String(el.type || '').toLowerCase();
      if (type === 'hidden') return false;
      if (type === 'radio' || type === 'checkbox') {
        const name = el.name;
        if (name) return !document.querySelector(`input[name="${CSS.escape(name)}"]:checked`);
        return !el.checked;
      }
      if (type === 'file') return !(el.files && el.files.length);
      if (el.tagName === 'SELECT') return !String(el.value || '').trim() || /choose|select/i.test(textOf(el.options?.[el.selectedIndex]));
      if (el.matches('input,textarea')) return !String(el.value || '').trim();
      const text = norm(textOf(el));
      return !text || text === 'chooseoption' || text === 'select' || text === 'selectoption';
    });
  }

  function hasManualSecurityGate() {
    return !!document.querySelector('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],.g-recaptcha,.h-captcha') ||
      /captcha/i.test(document.body?.innerText || '');
  }

  let lastObservedStep=0,autoAdvanceAttemptedStep=0;
  async function autoAdvance(step, missing) {
    if (!step || stopped) return false;
    if (step !== lastObservedStep) { lastObservedStep = step; autoAdvanceAttemptedStep = 0; }
    if (autoAdvanceAttemptedStep === step) return false;

    const next = findNextButton();
    if (!next) {
      report(`Step ${step} complete — no Continue/Next button found.`, {step});
      return false;
    }
    if (hasManualSecurityGate()) {
      report(`Step ${step} paused — CAPTCHA/security check requires manual completion.`, {step});
      return false;
    }
    const required = requiredUnfilledControls();
    if (required.length) {
      report(`Step ${step} paused — ${required.length} required field(s) still incomplete.`, {step,required:required.length});
      return false;
    }
    if (missing > 0) {
      report(`Step ${step} paused — ${missing} saved field(s) could not be located.`, {step,missing});
      return false;
    }

    if(step===1 && !pageOneAllConfirmed()){
      report('Page 1 paused — all three dropdown values must be confirmed before NEXT can run.',{step,action:'blocked-next'});
      return false;
    }
    autoAdvanceAttemptedStep = step;
    report(`Step ${step} complete — opening next page automatically…`, {step,action:'auto-next'});
    const beforeUrl = location.href;
    // Navigation is deliberately separate from field tapping. We click the DOM node
    // that was positively identified as forward-only; no coordinate tap is used here.
    try { next.focus?.(); next.click(); } catch (_) {}

    // Wait for a SPA step transition or a normal navigation.
    for (let i=0; i<24; i++) {
      await sleep(250);
      const newStep = detectStep();
      if ((newStep && newStep !== step) || location.href !== beforeUrl) {
        lastObservedStep = newStep || step + 1;
        autoAdvanceAttemptedStep = 0;
        report(newStep ? `Step ${newStep} loaded — continuing automation.` : 'Next page loaded — continuing automation.', {step:newStep || 0});
        return true;
      }
    }
    const errors = visibleValidationMessages();
    if (errors.length) {
      report(`Step ${step} could not continue — ${errors[0]}`, {step,validation:errors.slice(0,5)});
    } else {
      report(`Step ${step} did not advance after Continue. Check any highlighted required field.`, {step});
    }
    return false;
  }

  let currentApplicant=null,stopped=false,busy=false;
  async function fillCurrentPage(advanceToNext=false, automatic=false){
    if(stopped||busy||!currentApplicant)return false; busy=true;
    try{
      const step=detectStep();
      const keys=step===1 ? ['nationality','visa_category','passport_type'] : (step>=2&&step<=4?pageOrder[step-1]:[]);
      let filled=0,missing=0;
      if(!step){ report('Automation waiting — an eVisa Page 1–8 form is not currently detected.',{step:0,automatic}); return false; }
      if(step===5){ report('Page 5 detected — uploading assigned supporting documents.',{step,automatic:true}); return await runSupportingDocuments(); }
      if(step>=6&&step<=8){ report(`Page ${step} detected — applying saved/default radio answers.`,{step,automatic:true}); return await runSimpleRadioPage(step); }
      report(step?`Step ${step}: autofilling automatically…`:'Autofilling visible eVisa fields…',{step,automatic,advance:!!advanceToNext});
      for(const key of keys){
        if(stopped)break; const value=currentApplicant[key]; if(value==null||String(value).trim()==='')continue;
        if(key==='has_nigerian_passport'){
          const ok=await setRadioQuestion(key,value); if(ok){filled++;report('Filled Nigerian passport answer',{step,field:key});await sleep(120);}else{missing++;report('Could not find Nigerian passport Yes/No control',{step,field:key});} continue;
        }
        if(step===1){
          const existing=pageOneControl(key); const desired=norm(value);
          if(existing?.dataset?.evisaFilled===desired && pageOneValueConfirmed(key,value)) continue;
          const ok=await setPageOneField(key,value);
          if(ok){filled++;report(`Filled ${key.replace(/_/g,' ')}`,{step,field:key});await sleep(520);}else{missing++;report(`Could not match ${key.replace(/_/g,' ')}`,{step,field:key});}
          continue;
        }
        if(step===2 && key==='date_of_birth'){
          const ok=await setPageTwoDateOfBirth(value);
          if(ok){filled++;report('Filled date of birth',{step,field:key});await sleep(120);}
          else{missing++;report('Could not fill date of birth',{step,field:key});}
          continue;
        }
        const el=findControl(key); if(!el){missing++;continue;} const desired=norm(value); if(el.dataset?.evisaFilled===desired)continue;
        const ok=await setControl(el,key,value); if(ok){filled++;report(`Filled ${key.replace(/_/g,' ')}`,{step,field:key});await sleep(120);}else{missing++;report(`Could not match ${key.replace(/_/g,' ')}`,{step,field:key});}
      }
      if(step===2){ const photo=photoAssignment(currentApplicant); if(photo){ const attached=await autoPassportPhoto(); if(attached)filled++; else report('Passport photo assignment found, but upload control was not ready yet.',{step,field:'passport_photo'}); } }
      report(`${step?`Step ${step}`:'Page'} processed — ${filled} field(s) filled${missing?`, ${missing} unresolved`:''}.`,{step,filled,missing,automatic});
      if(advanceToNext){ await sleep(350); if(step===1 && !pageOneAllConfirmed()) report('Page 1 FILL + NEXT stopped — dropdown values are not all confirmed.',{step,action:'blocked-next'}); else await autoAdvance(step, missing); }
      else report(`Step ${step || ''} filled.`,{step,action:'filled'});
      return true;
    }catch(e){report(`Automation error: ${e?.message||e}`,{error:String(e)});return false;}finally{busy=false;}
  }
  function start(app){
    currentApplicant=app||currentApplicant;
    stopped=false;
    autoMode=true;
    autoPageToken=''; autoRetryCount=0;
    startDetector();
    const step=detectStep();
    report('Applicant loaded — hands-free automation enabled. Pages 1–8 will be detected automatically.',{automatic:true,step});
    if(step) scheduleAutoStep(step,true);
    return JSON.stringify({ok:true,mode:'hands-free-state-machine',url:location.href,step});
  }
  function stop(){stopped=true;autoMode=false;clearTimeout(autoTimer);report('Automation stopped.');}
  g.EVisaPortalAutomation={start,run:start,stop,fillCurrentPage,detectStep,startDetector};
})(window);

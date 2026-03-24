    const { useState, useMemo, useEffect } = React;

    // ─── Design Tokens ───
    const T = {
      bg0:"#0C0D10",bg1:"#12141A",bg2:"#181B23",bg3:"#1E2130",
      border:"#252B3B",
      text1:"#DDE1F0",text2:"#8690A8",text3:"#525C72",
      accent:"#4F7AF8",accentDim:"rgba(79,122,248,.12)",accentGlow:"rgba(79,122,248,.35)",
      success:"#22C55E",successDim:"rgba(34,197,94,.12)",
      danger:"#EF4444",dangerDim:"rgba(239,68,68,.12)",
      warning:"#F59E0B",warningDim:"rgba(245,158,11,.12)",
      info:"#3B82F6",infoDim:"rgba(59,130,246,.12)",
      purple:"#A855F7",purpleDim:"rgba(168,85,247,.12)",
      cyan:"#06B6D4",cyanDim:"rgba(6,182,212,.12)",
      orange:"#F97316",orangeDim:"rgba(249,115,22,.12)",
    };

    const CAT_COLORS = {EASY_WIN:T.success,CONFLICT:T.purple,BLOCKED:T.danger,WAITING:T.info,FAST_REJECT:T.danger,NOT_STARTED:T.text3,CHRONIC:T.warning,MISSING:T.warning};
    const ACT_COLORS = {ISSUE_VISA:T.success,ARBITRATE:T.purple,ESCALATE:T.orange,CHASE:T.warning,HOLD:T.text3,DONE:T.success};
    const TAG_COLORS = {REF:T.danger,DEF:T.danger,SUSP:T.warning,VSO:T.success,VAO:T.success,FAV:T.success,VAO_SAS:T.info,SS:T.info,HM:T.text3,NONE:T.text3,EN_ATTENTE:T.warning};

    const Badge = ({children,bg,color,s}) => (
      <span style={{display:"inline-flex",alignItems:"center",padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".4px",background:bg,color,lineHeight:"18px",whiteSpace:"nowrap",...(s||{})}}>{children}</span>
    );

    function HBar({items}) {
      return (
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {items.map((it,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:9.5,color:T.text2,width:65,textAlign:"right",fontFamily:"monospace"}}>{it.label}</span>
              <div style={{flex:1,height:8,background:T.bg3,borderRadius:4,overflow:"hidden"}}>
                <div style={{width:`${it.pct}%`,height:"100%",background:it.color,borderRadius:4,transition:"width .3s"}} />
              </div>
              <span style={{fontSize:10,fontWeight:700,color:it.color,width:28}}>{it.value}</span>
            </div>
          ))}
        </div>
      );
    }

    function TrendChart({trend}) {
      const [selected, setSelected] = useState("global");
      if (!trend) return null;

      const missions = Object.keys(trend.by_mission || {}).sort();
      const options = [{value:"global",label:"Global"},...missions.map(m=>({value:m,label:m}))];
      const pts = selected === "global" ? (trend.global||[]) : (trend.by_mission?.[selected]||[]);
      if (!pts.length) return null;

      const counts = pts.map(p=>p.count);
      const max = Math.max(...counts), min = Math.min(...counts);
      const range = max - min || 1;
      const h = 55, w = 240;
      const padTop = 4, usableH = h * 0.85;

      const path = counts.map((v,i) => {
        const x = (i/(counts.length-1))*w;
        const y = h - ((v-min)/range)*usableH - padTop;
        return `${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");

      // Color: green if trending down, red if trending up
      const delta = counts[counts.length-1] - counts[0];
      const lineColor = delta <= 0 ? T.success : T.danger;

      return (
        <div>
          <select value={selected} onChange={e=>setSelected(e.target.value)} style={{
            background:T.bg3,border:`1px solid ${T.border}`,borderRadius:4,
            color:T.text1,fontSize:9,padding:"2px 4px",marginBottom:6,outline:"none",width:"100%"
          }}>
            {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg width="100%" viewBox={`0 0 ${w} ${h+14}`} style={{display:"block"}}>
            <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={lineColor} stopOpacity="0.2"/><stop offset="100%" stopColor={lineColor} stopOpacity="0"/></linearGradient></defs>
            <path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#tg)"/>
            <path d={path} fill="none" stroke={lineColor} strokeWidth="1.5"/>
            <text x="0" y={h+10} fill={T.text3} fontSize="7" fontFamily="monospace">{pts[0]?.date?.slice(5)||""}</text>
            <text x={w} y={h+10} fill={T.text3} fontSize="7" fontFamily="monospace" textAnchor="end">{pts[pts.length-1]?.date?.slice(5)||""}</text>
            <text x={w/2} y={h+10} fill={lineColor} fontSize="7.5" fontFamily="monospace" textAnchor="middle" fontWeight="700">{counts[counts.length-1]} ({delta>=0?"+":""}{delta})</text>
          </svg>
        </div>
      );
    }

    function DetailPanel({item}) {
      const [tab, setTab] = useState(0);
      if (!item) return <div style={{width:310,background:T.bg1,borderLeft:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><div style={{textAlign:"center",color:T.text3,fontSize:12}}>Sélectionnez un document</div></div>;
      const tabs = ["Vue","Viseurs","Hist.","Comm.","Logs"];
      const completionPct = item.completion_ratio != null ? Math.round(item.completion_ratio * 100) : 0;

      return (
        <div style={{width:310,background:T.bg1,borderLeft:`1px solid ${T.border}`,padding:12,overflowY:"auto",flexShrink:0}}>
          <div style={{fontSize:12.5,fontWeight:700,color:T.text1,marginBottom:2}}>{item.titre}</div>
          <div style={{fontSize:9,color:T.text3,marginBottom:8,fontFamily:"monospace",wordBreak:"break-all"}}>{item.doc}</div>
          <div style={{display:"flex",gap:3,marginBottom:10,flexWrap:"wrap"}}>
            {item.sl.map(s => {const c=CAT_COLORS[s]||T.text3; return <Badge key={s} bg={`${c}22`} color={c}>{s.replace(/_/g," ")}</Badge>;})}
          </div>
          <div style={{display:"flex",gap:1,marginBottom:10}}>
            {tabs.map((t,i) => <div key={t} onClick={()=>setTab(i)} style={{padding:"3px 7px",fontSize:9.5,fontWeight:600,cursor:"pointer",borderRadius:4,background:tab===i?T.accentDim:"transparent",color:tab===i?T.accent:T.text3,border:tab===i?`1px solid ${T.accentGlow}`:"1px solid transparent"}}>{t}</div>)}
          </div>

          {tab===0 && <div>
            <div style={{background:T.bg2,borderRadius:8,padding:10,border:`1px solid ${T.border}`,marginBottom:8}}>
              <div style={{fontSize:10,color:T.text2,marginBottom:6}}>
                {item.overdue > 0 ? `${item.overdue}j retard` : "Pas de retard"} · {item.consensus} · Rev {item.rev} · Score {item.score}/100
              </div>
              {[{l:"Retard",p:Math.min((item.overdue||0)/1.5,100)},{l:"Complétude",p:completionPct},{l:"Révision",p:Math.min(item.rev*20,100)},{l:"Urgence",p:item.score}].map(c=>
                <div key={c.l} style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                  <span style={{fontSize:9,color:T.text3,width:65}}>{c.l}</span>
                  <div style={{flex:1,height:3,background:T.bg3,borderRadius:2}}><div style={{width:`${c.p}%`,height:"100%",background:T.accent,borderRadius:2}}/></div>
                </div>
              )}
            </div>
            <div style={{background:T.bg2,borderRadius:8,padding:10,border:`1px solid ${T.border}`,marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:T.text1,marginBottom:4}}>État</div>
              <div style={{fontSize:10,color:T.text2,lineHeight:1.6}}>
                <div>{item.blocking_summary}</div>
                <div style={{marginTop:4,fontSize:9.5}}>
                  Décision: <Badge bg={item.final_decision==="rejected"?T.dangerDim:item.final_decision==="approved"?T.successDim:T.warningDim} color={item.final_decision==="rejected"?T.danger:item.final_decision==="approved"?T.success:T.warning}>{item.final_decision}</Badge>
                  {" "}Qualité: <Badge bg={T.infoDim} color={T.info}>{item.approval_quality}</Badge>
                </div>
                {item.worst_tag && <div style={{marginTop:4,fontSize:9.5}}>Pire tag: <Badge bg={`${TAG_COLORS[item.worst_tag]||T.text3}22`} color={TAG_COLORS[item.worst_tag]||T.text3}>{item.worst_tag}</Badge></div>}
              </div>
            </div>
            <div style={{background:T.bg2,borderRadius:8,padding:10,border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.accent}`}}>
              <div style={{fontSize:10,fontWeight:700,color:T.text1,marginBottom:3}}>Action requise</div>
              <div style={{fontSize:10.5,color:T.text2}}>{item.action_needed}</div>
              {item.is_moex_holder && <div style={{fontSize:9,color:T.warning,marginTop:3}}>MOEX tient ce document{item.is_moex_late?" (en retard)":""}</div>}
              {item.is_arbitration_required && <div style={{fontSize:9,color:T.purple,marginTop:2}}>Arbitrage requis</div>}
            </div>
            <div style={{background:T.bg2,borderRadius:8,padding:10,border:`1px solid ${T.border}`,marginTop:8}}>
              <div style={{fontSize:10,fontWeight:700,color:T.text1,marginBottom:4}}>Responsabilité</div>
              {(()=>{
                const rp=item.responsibility_phase;
                const rc=rp==="primary"?T.cyan:rp==="secondary"?T.purple:rp==="moex_relance_secondary"?T.warning:T.orange;
                const rl=rp==="primary"?"Consultants Primaires":rp==="secondary"?"Consultants Secondaires":rp==="moex_relance_secondary"?"MOEX — Relance Secondaires":"MOEX — Clôture";
                const sub=item.moex_sub_phase;
                const subLabel=sub==="all_responded"?"Tous répondu — prêt à clôturer":sub==="secondary_default"?"Secondaires défaillants (>30j)":sub==="no_secondary"?"Aucun secondaire solicité":sub==="orphan"?"Données manquantes":null;
                const subColor=sub==="all_responded"?T.success:sub==="secondary_default"?T.danger:T.text3;
                return <div>
                  <Badge bg={`${rc}22`} color={rc}>{rl}</Badge>
                  {sub&&<div style={{marginTop:4}}><Badge bg={`${subColor}22`} color={subColor}>{subLabel}</Badge></div>}
                  {item.responsible_missions&&item.responsible_missions.length>0&&<div style={{fontSize:9,color:T.text3,marginTop:3}}>{item.responsible_missions.join(", ")}</div>}
                  {item.defaulted_missions&&item.defaulted_missions.length>0&&<div style={{fontSize:9,color:T.danger,marginTop:2}}>Défaillants: {item.defaulted_missions.join(", ")}</div>}
                  {item.secondary_window_remaining!=null&&<div style={{fontSize:9,color:T.purple,marginTop:2}}>{item.secondary_window_remaining}j restants dans la fenêtre secondaire</div>}
                  {rp==="moex_relance_secondary"&&item.secondary_elapsed_days!=null&&<div style={{fontSize:9,color:T.warning,marginTop:2}}>{item.secondary_elapsed_days}j depuis réponse primaires — relance requise</div>}
                  {rp==="moex"&&sub==="secondary_default"&&item.defaulted_missions&&item.defaulted_missions.length>0&&<div style={{fontSize:9,color:T.orange,marginTop:2}}>Validé sous réserve de validation définitif de {item.defaulted_missions.join(" et/ou ")}</div>}
                  {rp==="moex"&&sub==="all_responded"&&<div style={{fontSize:9,color:T.success,marginTop:2}}>Tous les consultants ont répondu — synthèse MOEX</div>}
                </div>;
              })()}
            </div>
          </div>}

          {tab===1 && <div>
            {(item.responses||[]).map((r,i) => {
              const tagC = TAG_COLORS[r.response_tag_code] || T.text3;
              const icon = r.is_pending ? "\u23F3" : (r.response_severity === "blocking" ? "\u274C" : "\u2705");
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div>
                    <div style={{fontSize:10.5,color:T.text1}}>
                      {icon} {r.actor_clean}
                      {r.is_moex && <span style={{fontSize:8,color:T.warning,marginLeft:4}}>[MOEX]</span>}
                      {!r.is_relevant && <span style={{fontSize:8,color:T.text3,marginLeft:4}}>[hors mission]</span>}
                    </div>
                    {r.is_late && <div style={{fontSize:8.5,color:T.danger}}>En retard{r.deadline_date ? ` (deadline: ${r.deadline_date})` : ""}</div>}
                  </div>
                  {r.response_tag_code ? (
                    <Badge bg={`${tagC}22`} color={tagC}>{r.response_tag_code}</Badge>
                  ) : (
                    <Badge bg={T.warningDim} color={T.warning}>EN ATTENTE</Badge>
                  )}
                </div>
              );
            })}
            <div style={{marginTop:8,fontSize:9.5,color:T.text3}}>
              {item.responded_count}/{item.responded_count + item.pending_count} réponses · Complétude {completionPct}%
            </div>
          </div>}

          {tab===3 && <div>
            <div style={{fontSize:10,fontWeight:700,color:T.text2,textTransform:"uppercase",marginBottom:6}}>Commentaires par acteur</div>
            {Object.keys(item.comments_by_actor||{}).length === 0 ? (
              <div style={{fontSize:10,color:T.text3,textAlign:"center",padding:20}}>Aucun commentaire</div>
            ) : (
              Object.entries(item.comments_by_actor).map(([actor, comments]) => (
                <div key={actor} style={{marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.text1,marginBottom:3}}>{actor}</div>
                  {comments.map((c, ci) => (
                    <div key={ci} style={{background:T.bg2,borderRadius:5,padding:6,marginBottom:3,border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:9.5,color:T.text2,lineHeight:1.5}}>{c.length > 200 ? c.slice(0, 200) + "..." : c}</div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>}

          {(tab===2||tab===4) && <div style={{textAlign:"center",padding:30,color:T.text3,fontSize:11}}>
            {tab===2 ? `Historique: Rev ${item.indice || "\u2014"} · ${item.aging_days != null ? item.aging_days + "j depuis première deadline" : "\u2014"}` : "Logs import & traçabilité"}
          </div>}
        </div>
      );
    }

    function ChatPanel({open, onClose, kpis}) {
      const [msgs, setMsgs] = useState([{r:"ai",t:"Bonjour! Assistant IA JANSA VISASIST. Je peux expliquer un statut ou interroger les données projet."}]);
      const [inp, setInp] = useState("");
      if (!open) return null;
      const send = () => {
        if (!inp.trim()) return;
        const q = inp; setInp("");
        setMsgs(m=>[...m,{r:"user",t:q}]);
        setTimeout(()=>{
          const ql = q.toLowerCase();
          let reply;
          if (ql.includes("retard")||ql.includes("overdue")) reply=`${kpis?.late||0} documents en retard. Délai moyen: ${kpis?.avg_delay_days||0}j.`;
          else if (ql.includes("moex")) reply=`MOEX tient ${kpis?.moex_holds||0} documents. ${kpis?.moex_late||0} en retard.`;
          else if (ql.includes("bloqué")||ql.includes("blocked")) reply=`${kpis?.blocked||0} documents bloqués. ${kpis?.arbitration||0} requièrent un arbitrage.`;
          else reply=`Pipeline: ${kpis?.total_submittals||0} docs total. ${kpis?.total_open||0} ouverts, ${kpis?.total_closed||0} clôturés (${kpis?.clean_close||0} propres, ${kpis?.forced_close||0} forcées). ${kpis?.pending||0} en attente, ${kpis?.late||0} en retard.`;
          setMsgs(m=>[...m,{r:"ai",t:reply}]);
        },300);
      };
      return (
        <div style={{position:"fixed",right:0,top:0,width:340,height:"100vh",background:T.bg1,borderLeft:`1px solid ${T.border}`,zIndex:100,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:700,color:T.text1}}>Assistant IA</span><Badge bg={T.accentDim} color={T.accent}>M6</Badge></div>
            <div onClick={onClose} style={{cursor:"pointer",color:T.text3,fontSize:18}}>&times;</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:10,display:"flex",flexDirection:"column",gap:7}}>
            {msgs.map((m,i)=><div key={i} style={{alignSelf:m.r==="user"?"flex-end":"flex-start",maxWidth:"88%",background:m.r==="user"?T.accentDim:T.bg2,border:`1px solid ${m.r==="user"?T.accentGlow:T.border}`,borderRadius:9,padding:"6px 10px"}}>
              {m.r==="ai"&&<div style={{fontSize:8,color:T.text3,marginBottom:2}}>Advisory only</div>}
              <div style={{fontSize:11,color:T.text1,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{m.t}</div>
            </div>)}
          </div>
          <div style={{padding:8,borderTop:`1px solid ${T.border}`,display:"flex",gap:6}}>
            <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Question..." style={{flex:1,background:T.bg2,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 9px",color:T.text1,fontSize:11,outline:"none"}}/>
            <button onClick={send} style={{background:T.accent,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",cursor:"pointer",fontSize:10.5,fontWeight:600}}>OK</button>
          </div>
        </div>
      );
    }

    function App() {
      const [data, setData] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [view, setView] = useState("dashboard");
      const [slFilter, setSlFilter] = useState(null);
      const [selItem, setSelItem] = useState(null);
      const [chatOpen, setChatOpen] = useState(false);

      useEffect(() => {
        if (window.COCKPIT_DATA) { setData(window.COCKPIT_DATA); setLoading(false); return; }
        fetch("../output/cockpit_data.json?v=" + Date.now())
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(d => { setData(d); setLoading(false); })
          .catch(e => { setError(e.message); setLoading(false); });
      }, []);

      const QUEUE_DATA = data?.queue || [];
      const LOTS = data?.lots || [];
      const CATS = data?.categories || [];
      const kpis = data?.kpis || {};
      const slCounts = data?.smart_list_counts || {};
      const missionStats = data?.mission_stats || [];
      const closedSummary = data?.closed_summary || {};
      const trend30j = data?.trend_30j || null;

      const filtered = useMemo(()=>{
        if (!slFilter) return QUEUE_DATA;
        return QUEUE_DATA.filter(q=>q.sl.includes(slFilter)||q.cat===slFilter);
      },[slFilter, QUEUE_DATA]);

      const nav = [{i:"\u25EB",l:"Tableau de Bord",k:"dashboard"},{i:"\u2630",l:"File Priorité",k:"queue"},{i:"\u25CE",l:"Document",k:"workspace"},{i:"\u2726",l:"Suggestions",k:"suggestions"},{i:"\u25A4",l:"Rapports",k:"reports"}];

      if (loading) return <div style={{background:T.bg0,color:T.text1,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system,sans-serif"}}><div style={{textAlign:"center"}}><div style={{fontSize:24,marginBottom:8}}>JV</div><div style={{fontSize:12,color:T.text3}}>Chargement cockpit_data.json...</div></div></div>;
      if (error) return <div style={{background:T.bg0,color:T.danger,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system,sans-serif",padding:40}}><div style={{textAlign:"center",maxWidth:500}}><div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Erreur de chargement</div><div style={{fontSize:12,color:T.text2,marginBottom:12}}>{error}</div><div style={{fontSize:11,color:T.text3}}>Lancez le serveur: <code style={{background:T.bg2,padding:"2px 6px",borderRadius:3}}>python -m http.server 3000</code> depuis le dossier projet</div></div></div>;

      return (
        <div style={{background:T.bg0,color:T.text1,fontFamily:"-apple-system,'Segoe UI',sans-serif",minHeight:"100vh",fontSize:13,lineHeight:1.4}}>
          {/* Sidebar */}
          <div style={{width:50,background:T.bg1,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:10,gap:3,position:"fixed",top:0,left:0,height:"100vh",zIndex:50}}>
            <div style={{width:28,height:28,borderRadius:6,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",marginBottom:8}}>JV</div>
            {nav.map(n=><div key={n.k} title={n.l} onClick={()=>{setView(n.k);setSlFilter(null);setSelItem(null);}} style={{width:34,height:34,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,background:view===n.k?T.accentDim:"transparent",border:view===n.k?`1px solid ${T.accentGlow}`:"1px solid transparent",color:view===n.k?T.accent:T.text3}}>{n.i}</div>)}
            <div style={{flex:1}}/>
            <div title="Chat IA" onClick={()=>setChatOpen(!chatOpen)} style={{width:34,height:34,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:10,fontWeight:700,marginBottom:10,background:chatOpen?T.accentDim:"transparent",color:chatOpen?T.accent:T.text3}}>AI</div>
          </div>

          {/* Topbar */}
          <div style={{height:44,background:T.bg1,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 16px",gap:12,marginLeft:50}}>
            <span style={{fontSize:13,fontWeight:700,color:T.text1}}>P17&CO Tranche 2</span>
            <span style={{fontSize:11,color:T.text3}}>{kpis.total_submittals||0} docs · {kpis.total_open||0} ouverts · {kpis.total_closed||0} clôturés · {kpis.total_emetteurs||0} émetteurs</span>
            <div style={{flex:1}}/>
            <Badge bg={T.successDim} color={T.success}>Run · {data?.generated_at || "\u2014"}</Badge>
          </div>

          <div style={{marginLeft:50,padding:"12px 16px"}}>

            {/* DASHBOARD */}
            {view==="dashboard" && <div>
              <div style={{fontSize:16,fontWeight:700,color:T.text1,marginBottom:2}}>Tableau de Bord</div>
              <div style={{fontSize:11,color:T.text3,marginBottom:12}}>Vue d'ensemble pipeline VISA · {data?.generated_at||""}</div>

              <div style={{display:"flex",gap:10,marginBottom:12}}>
                {[
                  {icon:"\u2705",title:"Actions Rapides",count:slCounts.EASY_WIN||0,sub:"Tous viseurs alignés \u2014 VAO",color:T.success,dim:T.successDim,act:"TRAITER",key:"EASY_WIN"},
                  {icon:"\u26A1",title:"Contradictions",count:slCounts.CONFLICT||0,sub:"Arbitrage MOEX requis",color:T.purple,dim:T.purpleDim,act:"EXAMINER",key:"CONFLICT"},
                  {icon:"\uD83D\uDCC9",title:"Pire Émetteur",count:kpis.worst_emetteur||"\u2014",sub:`${kpis.worst_emetteur||"\u2014"} · Santé ${kpis.worst_emetteur_score||0} · ${kpis.worst_emetteur_late||0} retards`,color:T.danger,dim:T.dangerDim,act:"CLASSEMENT",key:"_reports"},
                  {icon:"\uD83D\uDD04",title:"Récurrents",count:slCounts.CHRONIC||0,sub:"3+ révisions ou 60j+ âge",color:T.warning,dim:T.warningDim,act:"ESCALADER",key:"CHRONIC"},
                ].map(c=>(
                  <div key={c.key} onClick={()=>{if(c.key==="_reports"){setView("reports")}else{setView("queue");setSlFilter(c.key);}}} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",cursor:"pointer",flex:1,minWidth:160,borderLeft:`3px solid ${c.color}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontSize:10,color:T.text3,fontWeight:600,letterSpacing:".4px",textTransform:"uppercase",marginBottom:3}}>{c.icon} {c.title}</div>
                        <div style={{fontSize:26,fontWeight:800,color:c.color,lineHeight:1}}>{c.count}</div>
                      </div>
                      <Badge bg={c.dim} color={c.color} s={{fontSize:9}}>{c.act}</Badge>
                    </div>
                    <div style={{fontSize:10.5,color:T.text2,marginTop:5}}>{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Open/Closed headline */}
              <div style={{display:"flex",gap:10,marginBottom:12}}>
                {[
                  {l:"Total",v:kpis.total_submittals||0,w:`${kpis.total_emetteurs||0} émetteurs`,c:T.accent},
                  {l:"Ouverts",v:kpis.total_open||0,w:`Backlog actif`,c:T.warning},
                  {l:"Clôturés",v:kpis.total_closed||0,w:`${kpis.clean_close||0} propres · ${kpis.forced_close||0} forcés`,c:T.success},
                  {l:"En Retard",v:kpis.late||0,w:`Moy: ${kpis.avg_delay_days||0}j (ouverts)`,c:T.danger},
                  {l:"Bloqués",v:kpis.blocked||0,w:`Arbitrage: ${kpis.arbitration||0} (ouverts)`,c:T.danger},
                  {l:"MOEX tient",v:kpis.moex_holds||0,w:`${kpis.moex_late||0} en retard (ouverts)`,c:T.orange},
                ].map(k=>(
                  <div key={k.l} style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",flex:1,minWidth:110,borderTop:`2px solid ${k.c}`,cursor:"pointer"}}>
                    <div style={{fontSize:9.5,color:T.text3,fontWeight:600,letterSpacing:".3px",textTransform:"uppercase",marginBottom:4}}>{k.l}</div>
                    <div style={{fontSize:18,fontWeight:800,color:T.text1}}>{k.v}</div>
                    <div style={{fontSize:9,color:T.text3,marginTop:2}}>{k.w}</div>
                  </div>
                ))}
              </div>

              {/* Closed breakdown mini bar */}
              {kpis.total_closed > 0 && <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:T.text2,marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Clôtures MOEX par Visa</div>
                <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                  {Object.entries(kpis.closed_by_tag||{}).sort((a,b)=>b[1]-a[1]).map(([tag,cnt])=>{
                    const tc=TAG_COLORS[tag]||T.text3;
                    return <div key={tag} style={{display:"flex",alignItems:"center",gap:4}}>
                      <Badge bg={`${tc}22`} color={tc}>{tag}</Badge>
                      <span style={{fontSize:12,fontWeight:700,color:T.text1}}>{cnt}</span>
                    </div>;
                  })}
                  <span style={{fontSize:10,color:T.text3,marginLeft:8}}>
                    {kpis.clean_close||0} clôtures propres · {kpis.forced_close||0} clôtures forcées
                  </span>
                </div>
              </div>}

              {/* Responsibility attribution bar — 4 phases */}
              {kpis.total_open > 0 && <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:T.text2,marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Responsabilité (ouverts)</div>
                <div style={{display:"flex",gap:4,marginBottom:6}}>
                  {[
                    {label:"Primaires",count:kpis.resp_primary||0,color:T.cyan},
                    {label:"Secondaires",count:kpis.resp_secondary||0,color:T.purple},
                    {label:"MOEX Relance",count:kpis.resp_moex_relance||0,color:T.warning},
                    {label:"MOEX Clôture",count:kpis.resp_moex||0,color:T.orange},
                  ].map(it => (
                    <div key={it.label} style={{flex:Math.max(it.count,0),height:8,background:it.color,borderRadius:4,minWidth:it.count>0?4:0,transition:"flex .3s"}} title={`${it.label}: ${it.count}`} />
                  ))}
                </div>
                <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                  {[
                    {label:"Primaires",count:kpis.resp_primary||0,color:T.cyan},
                    {label:"Secondaires",count:kpis.resp_secondary||0,color:T.purple},
                    {label:"MOEX Relance",count:kpis.resp_moex_relance||0,color:T.warning},
                    {label:"MOEX Clôture",count:kpis.resp_moex||0,color:T.orange},
                  ].map(r => (
                    <div key={r.label} style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:8,height:8,borderRadius:2,background:r.color}} />
                      <span style={{fontSize:10.5,color:T.text1,fontWeight:700}}>{r.count}</span>
                      <span style={{fontSize:10,color:T.text3}}>{r.label}</span>
                    </div>
                  ))}
                </div>

                {/* Phase 4 (MOEX) decomposition — v1.6 */}
                {(kpis.resp_moex||0) > 0 && <div style={{marginTop:10,paddingTop:8,borderTop:`1px solid ${T.border}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.orange,marginBottom:6}}>Détail MOEX Clôture ({kpis.resp_moex})</div>
                  <div style={{display:"flex",gap:4,marginBottom:6}}>
                    {[
                      {label:"Tous répondu",count:kpis.moex_all_responded||0,color:T.success},
                      {label:"Secondaires défaillants",count:kpis.moex_secondary_default||0,color:T.danger},
                      {label:"Sans secondaires",count:kpis.moex_no_secondary||0,color:T.text3},
                      {label:"Orphelins",count:kpis.moex_orphan||0,color:T.text3},
                    ].map(it => (
                      <div key={it.label} style={{flex:Math.max(it.count,0),height:6,background:it.color,borderRadius:3,minWidth:it.count>0?3:0,transition:"flex .3s"}} title={`${it.label}: ${it.count}`} />
                    ))}
                  </div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    {[
                      {label:"Tous répondu",count:kpis.moex_all_responded||0,color:T.success,desc:"prêts à clôturer"},
                      {label:"Sec. défaillants",count:kpis.moex_secondary_default||0,color:T.danger,desc:">30j sans réponse"},
                      {label:"Sans secondaires",count:kpis.moex_no_secondary||0,color:T.text3,desc:"clôture directe"},
                      {label:"Orphelins",count:kpis.moex_orphan||0,color:T.text3,desc:"données manquantes"},
                    ].map(r => (
                      <div key={r.label} style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:6,height:6,borderRadius:2,background:r.color}} />
                        <span style={{fontSize:10.5,color:T.text1,fontWeight:700}}>{r.count}</span>
                        <span style={{fontSize:9.5,color:T.text3}}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Top defaulters */}
                  {(kpis.top_defaulters||[]).length > 0 && <div style={{marginTop:8}}>
                    <div style={{fontSize:9.5,fontWeight:700,color:T.danger,marginBottom:4}}>Missions défaillantes (secondaires qui ne répondent pas)</div>
                    {(kpis.top_defaulters||[]).map(d => (
                      <div key={d.mission} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <div style={{flex:`0 0 ${Math.min(Math.round(d.count/(kpis.moex_secondary_default||1)*100),100)}%`,height:4,background:T.danger,borderRadius:2,minWidth:4}} />
                        <span style={{fontSize:10,color:T.text1,fontWeight:600,whiteSpace:"nowrap"}}>{d.mission}</span>
                        <span style={{fontSize:10,color:T.danger,fontWeight:700}}>{d.count}</span>
                      </div>
                    ))}
                  </div>}
                </div>}
              </div>}

              <div style={{display:"flex",gap:10}}>
                <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.text2,marginBottom:8,textTransform:"uppercase",letterSpacing:".4px"}}>Catégories (ouverts)</div>
                  {CATS.map(c=>{const total=CATS.reduce((s,x)=>s+x.count,0)||1;const cc=CAT_COLORS[c.key]||T.text3;return(
                    <div key={c.key} onClick={()=>{setView("queue");setSlFilter(c.key);}} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 6px",borderRadius:5,cursor:"pointer",marginBottom:2}}>
                      <Badge bg={`${cc}22`} color={cc}>{c.name}</Badge>
                      <div style={{flex:1,height:4,background:T.bg3,borderRadius:2}}><div style={{width:`${Math.round(c.count/total*100)}%`,height:"100%",background:cc,borderRadius:2}}/></div>
                      <span style={{fontSize:11,fontWeight:700,color:T.text1,width:32,textAlign:"right"}}>{c.count}</span>
                    </div>
                  );})}
                </div>
                <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.text2,marginBottom:8,textTransform:"uppercase",letterSpacing:".4px"}}>Tendance 30j</div>
                  <TrendChart trend={trend30j}/>
                </div>
                <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.text2,marginBottom:8,textTransform:"uppercase",letterSpacing:".4px"}}>Santé Émetteurs</div>
                  <HBar items={LOTS.slice(0,6).map(l=>({label:l.code.length>8?l.code.slice(0,8):l.code,value:l.health,pct:l.health,color:l.health<40?T.danger:l.health<60?T.warning:T.info}))}/>
                </div>
              </div>
            </div>}

            {/* QUEUE */}
            {view==="queue" && <div style={{display:"flex"}}>
              <div style={{width:180,flexShrink:0,paddingRight:10,borderRight:`1px solid ${T.border}`,marginRight:10}}>
                <div style={{fontSize:10,fontWeight:700,color:T.text2,marginBottom:5,textTransform:"uppercase"}}>Listes Intelligentes</div>
                {[
                  {l:"\u2705 Actions Rapides",k:"EASY_WIN",c:T.success},
                  {l:"\u26A1 Contradictions",k:"CONFLICT",c:T.purple},
                  {l:"\uD83D\uDD04 Chroniques",k:"CHRONIC",c:T.warning},
                  {l:"\u274C Rejets Rapides",k:"FAST_REJECT",c:T.danger},
                  {l:"\u23F3 Manquants",k:"MISSING",c:T.warning},
                  {l:"\u26D4 Bloqués",k:"BLOCKED",c:T.danger},
                  {l:"\u231B En attente",k:"WAITING",c:T.info},
                ].map(f=>
                  <div key={f.k} onClick={()=>setSlFilter(slFilter===f.k?null:f.k)} style={{padding:"4px 6px",borderRadius:5,marginBottom:2,cursor:"pointer",fontSize:10,display:"flex",justifyContent:"space-between",background:slFilter===f.k?`${f.c}15`:"transparent",border:slFilter===f.k?`1px solid ${f.c}44`:"1px solid transparent",color:slFilter===f.k?f.c:T.text2}}>
                    <span>{f.l}</span><span style={{fontWeight:700,fontSize:9.5}}>{slCounts[f.k]||0}</span>
                  </div>
                )}
              </div>
              <div style={{flex:1,display:"flex",minWidth:0}}>
                <div style={{flex:1,overflowX:"auto"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <span style={{fontSize:13,fontWeight:700,color:T.text1}}>File de Priorité</span>
                    {slFilter&&<Badge bg={T.accentDim} color={T.accent}>{slFilter.replace(/_/g," ")} · {filtered.length}</Badge>}
                  </div>
                  <div style={{fontSize:10.5,color:T.text3,marginBottom:8}}>
                    {filtered.length} documents ouverts{slFilter&&<span onClick={()=>setSlFilter(null)} style={{color:T.accent,cursor:"pointer",marginLeft:6}}>{"\u2715"} Effacer</span>}
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>
                      {["Document","Lot","Cat.","Resp.","Score","Ret.","Rev","Action"].map(h=><th key={h} style={{padding:"4px 6px",fontSize:9.5,fontWeight:700,color:T.text3,textTransform:"uppercase",letterSpacing:".3px",textAlign:"left",borderBottom:`1px solid ${T.border}`,background:T.bg3}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {filtered.slice(0,100).map(it=>(
                        <tr key={it.id} onClick={()=>setSelItem(it)} style={{cursor:"pointer",background:selItem?.id===it.id?T.accentDim:"transparent"}}>
                          <td style={{padding:"7px 6px",borderBottom:`1px solid ${T.border}`,maxWidth:240}}>
                            <div style={{fontSize:11,fontWeight:600,color:T.text1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.doc.length>30?"..."+it.doc.slice(-27):it.doc}</div>
                            <div style={{fontSize:9.5,color:T.text3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220}}>{it.titre}</div>
                            <div style={{fontSize:8.5,color:T.text3}}>{it.overdue>0?`${it.overdue}j ret. · `:""}{it.consensus} · Rev {it.rev}</div>
                          </td>
                          <td style={{padding:"7px 4px",borderBottom:`1px solid ${T.border}`}}><Badge bg={`${T.text3}22`} color={T.text2}>{it.lot}</Badge></td>
                          <td style={{padding:"7px 4px",borderBottom:`1px solid ${T.border}`}}><Badge bg={`${CAT_COLORS[it.cat]||T.text3}22`} color={CAT_COLORS[it.cat]||T.text3}>{it.cat.replace(/_/g," ")}</Badge></td>
                          <td style={{padding:"7px 4px",borderBottom:`1px solid ${T.border}`}}>{(()=>{const rp=it.responsibility_phase;const sub=it.moex_sub_phase;const rc=rp==="primary"?T.cyan:rp==="secondary"?T.purple:rp==="moex_relance_secondary"?T.warning:sub==="all_responded"?T.success:sub==="secondary_default"?T.danger:T.orange;const rl=rp==="primary"?"PRIM":rp==="secondary"?"SEC":rp==="moex_relance_secondary"?"RELANCE":sub==="all_responded"?"CLÔT.":"DEF.SEC";return <Badge bg={`${rc}22`} color={rc}>{rl}</Badge>;})()}</td>
                          <td style={{padding:"7px 4px",borderBottom:`1px solid ${T.border}`,textAlign:"center"}}><Badge bg={it.score>=80?T.dangerDim:it.score>=60?T.warningDim:T.infoDim} color={it.score>=80?T.danger:it.score>=60?T.warning:T.info} s={{fontSize:11,fontWeight:800,minWidth:32,justifyContent:"center"}}>{it.score}</Badge></td>
                          <td style={{padding:"7px 4px",borderBottom:`1px solid ${T.border}`,color:it.overdue>0?T.danger:T.text3,fontSize:11,fontWeight:600}}>{it.overdue>0?`+${it.overdue}j`:"\u2014"}</td>
                          <td style={{padding:"7px 4px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:it.rev>2?700:400,color:it.rev>2?T.warning:T.text2,textAlign:"center"}}>{it.rev}</td>
                          <td style={{padding:"7px 4px",borderBottom:`1px solid ${T.border}`}}><Badge bg={`${ACT_COLORS[it.action]||T.text3}22`} color={ACT_COLORS[it.action]||T.text3}>{it.action.replace(/_/g," ")}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 100 && <div style={{padding:10,textAlign:"center",fontSize:10,color:T.text3}}>Affichage 100 / {filtered.length} documents</div>}
                </div>
                <DetailPanel item={selItem}/>
              </div>
            </div>}

            {/* REPORTS */}
            {view==="reports" && <div>
              <div style={{fontSize:16,fontWeight:700,color:T.text1,marginBottom:2}}>Rapports</div>
              <div style={{fontSize:11,color:T.text3,marginBottom:12}}>Santé émetteurs (tous) · Missions goulots (tous) · Analyse clôtures</div>

              <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text1,marginBottom:8}}>Santé des Émetteurs</div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["#","Émetteur","Santé","Total","Attente","Retard","Rejets","Conflits"].map(h=><th key={h} style={{padding:"6px 8px",fontSize:9.5,fontWeight:700,color:T.text3,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${T.border}`,background:T.bg3}}>{h}</th>)}</tr></thead>
                  <tbody>{LOTS.map((l,i)=>(
                    <tr key={l.code} style={{background:i%2?T.bg2:"transparent"}}>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:700,color:i<2?T.danger:i<4?T.warning:T.text2}}>#{i+1}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`}}><div style={{fontSize:11,fontWeight:600,color:T.text1}}>{l.code}</div></td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div style={{width:50,height:5,background:T.bg3,borderRadius:3}}><div style={{width:`${l.health}%`,height:"100%",borderRadius:3,background:l.health<40?T.danger:l.health<60?T.warning:l.health<75?T.info:T.success}}/></div>
                          <span style={{fontSize:11,fontWeight:800,color:l.health<40?T.danger:l.health<60?T.warning:T.text1}}>{l.health}</span>
                        </div>
                      </td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11}}>{l.total}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11}}>{l.pending}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,color:l.overdue>5?T.danger:T.text2,fontWeight:l.overdue>5?700:400}}>{l.overdue}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,color:l.ref>3?T.danger:T.text2}}>{l.ref}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,color:l.hard_conflict>2?T.warning:T.text2}}>{l.hard_conflict}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text1,marginBottom:8}}>Missions Goulots</div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["#","Mission","Tient","Seul","Retard","Multi","Conflits","Délai","Backlog"].map(h=><th key={h} style={{padding:"6px 8px",fontSize:9.5,fontWeight:700,color:T.text3,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${T.border}`,background:T.bg3}}>{h}</th>)}</tr></thead>
                  <tbody>{missionStats.slice(0,22).map((a,i)=>(
                    <tr key={a.mission} style={{background:i%2?T.bg2:"transparent"}}>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:700,color:i<3?T.danger:T.text2}}>#{i+1}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`}}>
                        <div style={{fontSize:11,fontWeight:600,color:T.text1}}>{a.mission}{a.is_moex&&<span style={{fontSize:8,color:T.warning,marginLeft:4}}>[MOEX]</span>}</div>
                        <div style={{fontSize:8.5,color:T.text3,marginTop:1}}>{a.actors.length>1?`${a.actors.length} acteurs regroupés`:a.actors[0]||""}</div>
                      </td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:700}}>{a.holds}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11}}>{a.sole_holds}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,color:a.late>5?T.danger:T.text2}}>{a.late}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11}}>{a.multi}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,color:a.conflicts>2?T.warning:T.text2}}>{a.conflicts}</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11}}>{a.avg_delay}j</td>
                      <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11}}>{a.backlog_share}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              {/* Closed analysis */}
              {closedSummary.count > 0 && <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text1,marginBottom:4}}>Analyse des Clôtures</div>
                <div style={{fontSize:10,color:T.text3,marginBottom:10}}>{closedSummary.count} submittals clôturés — responsabilité, taux de rejet, type de clôture</div>

                <div style={{display:"flex",gap:10,marginBottom:12}}>
                  <div style={{background:T.bg3,borderRadius:8,padding:"10px 14px",flex:1}}>
                    <div style={{fontSize:9.5,color:T.text3,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Par Type</div>
                    <div style={{display:"flex",gap:12}}>
                      <div><span style={{fontSize:18,fontWeight:800,color:T.success}}>{closedSummary.by_close_type?.clean_close||0}</span><div style={{fontSize:9,color:T.text3}}>Propres</div></div>
                      <div><span style={{fontSize:18,fontWeight:800,color:T.warning}}>{closedSummary.by_close_type?.forced_close||0}</span><div style={{fontSize:9,color:T.text3}}>Forcées</div></div>
                    </div>
                  </div>
                  <div style={{background:T.bg3,borderRadius:8,padding:"10px 14px",flex:1}}>
                    <div style={{fontSize:9.5,color:T.text3,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Par Visa MOEX</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {Object.entries(closedSummary.by_decision_tag||{}).sort((a,b)=>b[1]-a[1]).map(([tag,cnt])=>{
                        const tc=TAG_COLORS[tag]||T.text3;
                        return <div key={tag} style={{display:"flex",alignItems:"center",gap:3}}>
                          <Badge bg={`${tc}22`} color={tc}>{tag}</Badge>
                          <span style={{fontSize:12,fontWeight:700,color:T.text1}}>{cnt}</span>
                        </div>;
                      })}
                    </div>
                  </div>
                </div>

                <div style={{fontSize:10.5,fontWeight:700,color:T.text2,marginBottom:6,textTransform:"uppercase"}}>Taux de Rejet par Émetteur (clôturés)</div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["#","Émetteur","Clôturés","Rejetés","Taux Rejet"].map(h=><th key={h} style={{padding:"5px 8px",fontSize:9.5,fontWeight:700,color:T.text3,textTransform:"uppercase",textAlign:"left",borderBottom:`1px solid ${T.border}`,background:T.bg3}}>{h}</th>)}</tr></thead>
                  <tbody>{(closedSummary.emetteur_rejection||[]).filter(e=>e.total_closed>0).slice(0,15).map((e,i)=>(
                    <tr key={e.emetteur} style={{background:i%2?T.bg2:"transparent"}}>
                      <td style={{padding:"5px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:700,color:i<3&&e.rejection_rate>20?T.danger:T.text2}}>#{i+1}</td>
                      <td style={{padding:"5px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:600,color:T.text1}}>{e.emetteur}</td>
                      <td style={{padding:"5px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11}}>{e.total_closed}</td>
                      <td style={{padding:"5px 8px",borderBottom:`1px solid ${T.border}`,fontSize:11,color:e.rejected>0?T.danger:T.text2,fontWeight:e.rejected>0?700:400}}>{e.rejected}</td>
                      <td style={{padding:"5px 8px",borderBottom:`1px solid ${T.border}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div style={{width:50,height:5,background:T.bg0,borderRadius:3}}><div style={{width:`${Math.min(e.rejection_rate,100)}%`,height:"100%",borderRadius:3,background:e.rejection_rate>50?T.danger:e.rejection_rate>20?T.warning:T.success}}/></div>
                          <span style={{fontSize:11,fontWeight:700,color:e.rejection_rate>50?T.danger:e.rejection_rate>20?T.warning:T.text1}}>{e.rejection_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>}
            </div>}

            {!["dashboard","queue","reports"].includes(view) && <div style={{textAlign:"center",padding:50}}>
              <div style={{fontSize:30,marginBottom:8,opacity:.15}}>{view==="workspace"?"\u25CE":"\u2726"}</div>
              <div style={{fontSize:15,fontWeight:700,color:T.text1,marginBottom:5}}>{view==="workspace"?"Espace Document":"Recommandations"}</div>
              <div style={{fontSize:11.5,color:T.text3,marginBottom:12}}>Sélectionnez un document depuis la File de Priorité.</div>
              <span onClick={()=>setView("queue")} style={{color:T.accent,cursor:"pointer",fontSize:11.5,fontWeight:600}}>\u2192 File de Priorité</span>
            </div>}
          </div>

          <ChatPanel open={chatOpen} onClose={()=>setChatOpen(false)} kpis={kpis}/>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<App/>);

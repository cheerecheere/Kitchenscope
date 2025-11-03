// This is the whole magic recipe in one piece.
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';

const skuList = parse(readFileSync(join(process.cwd(),'data','sku-master.csv')), { columns: true });
const taskDB  = JSON.parse(readFileSync(join(process.cwd(),'data','tasks-db.json')));

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).send('Only POST please');

  const { menuText, space=12, panelAmps=40, gasBTU=80000 } = req.body;

  // 1. What tasks does the menu need?
  const tasks = [];
  if (menuText.toLowerCase().includes('fry'))     tasks.push({generic:'deep-fryer',   load:70});
  if (menuText.toLowerCase().includes('espresso')) tasks.push({generic:'espresso',   load:50});
  if (menuText.toLowerCase().includes('cake'))   tasks.push({generic:'oven',         load:30});

  // 2. Pick cheapest machine for each tier
  const tiers = ['home','cafe','pro'].map(tier => {
    let skus = [];
    tasks.forEach(t => {
      const ok = skuList.filter(s =>
        s.tier === tier &&
        s.genericName === t.generic &&
        parseFloat(s.footprintM2) <= space
      ).sort((a,b)=> parseFloat(a.usd) - parseFloat(b.usd));
      if (ok[0]) skus.push(ok[0]);
    });
    const electricAmps = skus.reduce((sum,s)=> sum + parseFloat(s.electricAmps), 0);
    const gasBTU       = skus.reduce((sum,s)=> sum + parseFloat(s.gasBTU), 0);
    return { tier, totalCostUSD: skus.reduce((sum,s)=> sum + parseFloat(s.usd), 0), electricAmps, gasBTU, skus };
  });

  // 3. Warnings
  const warnings = [];
  tiers.forEach(t=>{
    if (t.electricAmps > panelAmps) warnings.push(`${t.tier} tier uses ${t.electricAmps} A – you only have ${panelAmps} A.`);
    if (t.gasBTU > gasBTU) warnings.push(`${t.tier} tier uses ${t.gasBTU} BTU – you only have ${gasBTU} BTU.`);
  });

  res.json({ tiers: Object.fromEntries(tiers.map(t=>[t.tier,t])), warnings });
}
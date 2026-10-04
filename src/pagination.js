// Traverse a stable unique key, rather than treating the Data API's row cap as all records.
// Factories must return a fresh query. Smaller pages also work with reduced server row limits.
export async function readPages(factory,{pageSize=100}={}){
 const data=[];let after=null;
 for(;;){let query=factory().order('id',{ascending:true}).limit(pageSize);if(after!==null)query=query.gt('id',after);
  const page=await query;if(page.error)return {data:null,error:page.error};
  if(!page.data?.length)return {data,error:null};
  data.push(...page.data);const next=page.data.at(-1).id;
  if(next===after)throw Error('Pagination did not advance.');after=next;
 }
}
export async function chronologicalPages(factory,ascending=false){
 const result=await readPages(factory);result.data?.sort((a,b)=>{const order=a.created_at.localeCompare(b.created_at)||String(a.id).localeCompare(String(b.id));return ascending?order:-order;});return result;
}
export async function historyPage(factory,before=null){
 let q=factory().order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
 if(before)q=q.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
 return q;
}

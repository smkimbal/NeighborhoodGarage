export const trustTiers=[
 {name:'Bronze',key:'bronze',completed:3,reviews:2,neighbors:2,rating:4},
 {name:'Silver',key:'silver',completed:10,reviews:5,neighbors:3,rating:4.5},
 {name:'Gold',key:'gold',completed:25,reviews:10,neighbors:5,rating:4.7},
 {name:'Platinum',key:'platinum',completed:50,reviews:20,neighbors:10,rating:4.8}
].map(t=>Object.freeze(t));
export function trustFor(m={},role='owner'){
 const completed=Number(m[role==='owner'?'lent':'borrowed']||0),reviews=Number(m[role+'ReviewCount']||0),neighbors=Number(m[role+'Reviewers']||0),rating=Number(m[role+'Rating']||0);
 const qualifies=t=>completed>=t.completed&&reviews>=t.reviews&&neighbors>=t.neighbors&&rating+1e-9>=t.rating;
 return {role,tier:[...trustTiers].reverse().find(qualifies)||null,next:trustTiers.find(t=>!qualifies(t))||null,completed,reviews,neighbors,rating};
}
export function badgesFor(m={}){
 const {listed=0,borrowed=0,lent=0,reviewsWritten=0,ownerReviewsWritten=0,renterReviewsWritten=0}=m;
 const ownerRating=Number(m.ownerRating??m.rating??0),ownerReviews=Number(m.ownerReviewCount??m.reviewCount??0),renterRating=Number(m.renterRating||0),renterReviews=Number(m.renterReviewCount||0);
 const count=(name,icon,value,target,description)=>({name,icon,earned:value>=target,progress:`${value}/${target}`,description});
 const rated=(name,icon,value,target,rating,minimum,description)=>({name,icon,earned:value>=target&&rating>=minimum,progress:`${value}/${target} reviews · ${rating.toFixed(1)}/${minimum} stars`,description});
 return [
  count('Open garage','🧰',listed,1,'Share your first tool.'),count('Good neighbor','🤝',borrowed,1,'Complete your first rental.'),
  count('Tool explorer','🧭',borrowed,3,'Borrow three times.'),count('Project regular','🔨',borrowed,5,'Finish five borrowed projects.'),
  count('Helpful lender','🌻',lent,1,'Help your first neighbor finish a project.'),count('Full tool shelf','🗄️',listed,3,'Offer three tools to the neighborhood.'),
  count('Community lender','🌱',lent,5,'Help five neighbors finish a project.'),
  rated('Trusted owner','⭐',ownerReviews,3,ownerRating,4.5,'Earn three renter reviews averaging at least 4.5 stars.'),
  count('Neighborhood regular','🏡',borrowed,10,'Reuse tools across ten projects.'),count('Garage mentor','🏆',lent,10,'Complete ten neighbor loans.'),
  rated('Neighborhood favorite','💛',ownerReviews,10,ownerRating,4.8,'Earn ten excellent renter reviews.'),
  count('First feedback','💬',reviewsWritten,1,'Write an honest review with at least 30 characters after a completed rental.'),
  count('Community voice','📣',reviewsWritten,5,'Write five detailed reviews. Every honest rating counts.'),
  count('Review guide','📝',reviewsWritten,10,'Write ten detailed reviews to help neighbors plan.'),
  count('Neighborhood storyteller','📚',reviewsWritten,25,'Write twenty-five detailed reviews.'),
  count('Thoughtful renter','🪴',renterReviewsWritten,3,'Review three owners after renting their tools.'),
  count('Helpful host','🏠',ownerReviewsWritten,3,'Review three renters after receiving your tools back.'),
  rated('Trusted renter','🌟',renterReviews,2,renterRating,4.5,'Earn two owner reviews averaging at least 4.5 stars.'),
  rated('Careful borrower','🛡️',renterReviews,5,renterRating,4.8,'Earn five excellent owner reviews.'),
  count('Project veteran','🪚',borrowed,25,'Finish twenty-five borrowed projects.'),
  count('Sharing champion','🏅',lent,25,'Complete twenty-five neighbor loans.'),
  count('Community cornerstone','💎',lent,50,'Complete fifty neighbor loans.')
 ];
}
export function featuredBadge(m){return [...badgesFor(m)].reverse().find(b=>b.earned)||null;}

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from "recharts";

type FeedbackRow = {
  id: string;
  room_number: string;
  language: string;
  ratings: any;
  comments: any;
  submitted_at: string;
};

const COLORS = [
  "hsl(210, 60%, 45%)", "hsl(42, 85%, 55%)", "hsl(150, 50%, 45%)",
  "hsl(0, 65%, 55%)", "hsl(270, 50%, 55%)", "hsl(180, 50%, 45%)",
  "hsl(30, 70%, 50%)", "hsl(330, 50%, 50%)"
];

const RATING_MAP: Record<string, number> = { excellent: 4, veryGood: 3, good: 2, fair: 1 };
const RATING_LABELS: Record<string, string> = {
  services_reception: "Reception", services_laundry: "Laundry",
  services_housekeeping: "Housekeeping", services_cabins: "Cabins",
  services_cleanliness: "Cleanliness", services_maintenance: "Maintenance",
  facilities_restaurant: "Restaurant", facilities_loungeBar: "Lounge Bar",
  facilities_sundeckBar: "Sundeck Bar", facilities_swimmingPool: "Pool",
  food_quality: "Food Quality", food_quantity: "Food Quantity", food_variety: "Food Variety",
};

const DashboardCharts = ({ feedbackList }: { feedbackList: FeedbackRow[] }) => {
  // Average rating per category
  const categoryData = useMemo(() => {
    const cats: Record<string, { sum: number; count: number }> = {};
    feedbackList.forEach((f) => {
      if (f.ratings && typeof f.ratings === "object") {
        Object.entries(f.ratings as Record<string, string>).forEach(([key, val]) => {
          if (RATING_MAP[val] !== undefined) {
            if (!cats[key]) cats[key] = { sum: 0, count: 0 };
            cats[key].sum += RATING_MAP[val];
            cats[key].count++;
          }
        });
      }
    });
    return Object.entries(cats).map(([key, { sum, count }]) => ({
      name: RATING_LABELS[key] || key.replace(/_/g, " "),
      rating: +(sum / count).toFixed(2),
      fullMark: 4,
    })).sort((a, b) => b.rating - a.rating);
  }, [feedbackList]);

  // Section averages for radar
  const radarData = useMemo(() => {
    const sections: Record<string, { sum: number; count: number }> = {
      Services: { sum: 0, count: 0 },
      Facilities: { sum: 0, count: 0 },
      Food: { sum: 0, count: 0 },
    };
    feedbackList.forEach((f) => {
      if (f.ratings && typeof f.ratings === "object") {
        Object.entries(f.ratings as Record<string, string>).forEach(([key, val]) => {
          if (RATING_MAP[val] === undefined) return;
          const section = key.startsWith("services_") ? "Services" :
            key.startsWith("facilities_") ? "Facilities" :
            key.startsWith("food_") ? "Food" : null;
          if (section) {
            sections[section].sum += RATING_MAP[val];
            sections[section].count++;
          }
        });
      }
    });
    return Object.entries(sections).map(([name, { sum, count }]) => ({
      subject: name,
      score: count > 0 ? +((sum / count / 4) * 100).toFixed(1) : 0,
      fullMark: 100,
    }));
  }, [feedbackList]);

  // Language distribution
  const langData = useMemo(() => {
    const langs: Record<string, number> = {};
    feedbackList.forEach((f) => {
      const l = (f.language || "en").toUpperCase();
      langs[l] = (langs[l] || 0) + 1;
    });
    return Object.entries(langs)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [feedbackList]);

  // Trends over time (daily)
  const trendsData = useMemo(() => {
    const days: Record<string, { sum: number; count: number; responses: number }> = {};
    feedbackList.forEach((f) => {
      const day = f.submitted_at.slice(0, 10);
      if (!days[day]) days[day] = { sum: 0, count: 0, responses: 0 };
      days[day].responses++;
      if (f.ratings && typeof f.ratings === "object") {
        Object.values(f.ratings as Record<string, string>).forEach((val) => {
          if (RATING_MAP[val] !== undefined) {
            days[day].sum += RATING_MAP[val];
            days[day].count++;
          }
        });
      }
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count, responses }]) => ({
        date: date.slice(5),
        avgRating: count > 0 ? +((sum / count / 4) * 100).toFixed(1) : 0,
        responses,
      }));
  }, [feedbackList]);

  // Rating distribution
  const ratingDistribution = useMemo(() => {
    const dist: Record<string, number> = { Excellent: 0, "Very Good": 0, Good: 0, Fair: 0 };
    feedbackList.forEach((f) => {
      if (f.ratings && typeof f.ratings === "object") {
        Object.values(f.ratings as Record<string, string>).forEach((val) => {
          if (val === "excellent") dist.Excellent++;
          else if (val === "veryGood") dist["Very Good"]++;
          else if (val === "good") dist.Good++;
          else if (val === "fair") dist.Fair++;
        });
      }
    });
    return [
      { name: "Excellent", value: dist.Excellent, color: "hsl(150, 60%, 45%)" },
      { name: "Very Good", value: dist["Very Good"], color: "hsl(210, 60%, 50%)" },
      { name: "Good", value: dist.Good, color: "hsl(42, 85%, 55%)" },
      { name: "Fair", value: dist.Fair, color: "hsl(0, 60%, 55%)" },
    ].filter(d => d.value > 0);
  }, [feedbackList]);

  if (feedbackList.length === 0) return null;

  return (
    <div className="space-y-4 mt-6">
      {/* Row 1: Trends + Rating Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Rating Trends Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="avgRating" name="Avg Rating %" stroke="hsl(210, 60%, 45%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="responses" name="Responses" stroke="hsl(42, 85%, 55%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Rating Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={ratingDistribution}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {ratingDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Category Ratings Bar Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Average Ratings by Category</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 4]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(val: number) => [val.toFixed(2) + " / 4.00", "Rating"]}
              />
              <Bar dataKey="rating" radius={[0, 4, 4, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Row 3: Radar + Language Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Section Overview</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Radar name="Score" dataKey="score" stroke="hsl(210, 60%, 45%)" fill="hsl(210, 60%, 45%)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Language Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={langData}
                  cx="50%" cy="50%"
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {langData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardCharts;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Ban } from "lucide-react";
import { toast } from "sonner";

const travelersData = [
  { id: 1, name: "John Doe", email: "john@example.com", joinDate: "2025-10-15", status: "Active" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", joinDate: "2025-10-20", status: "Active" },
  { id: 3, name: "Bob Johnson", email: "bob@example.com", joinDate: "2025-11-01", status: "Active" },
  { id: 4, name: "Alice Williams", email: "alice@example.com", joinDate: "2025-11-05", status: "Active" },
  { id: 5, name: "Charlie Brown", email: "charlie@example.com", joinDate: "2025-11-10", status: "Active" },
];

export default function ManageTravelers() {
  const navigate = useNavigate();
  const [travelers, setTravelers] = useState(travelersData);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTravelers = travelers.filter(
    (traveler) =>
      traveler.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      traveler.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBanUser = (id: number) => {
    setTravelers(
      travelers.map((traveler) =>
        traveler.id === id ? { ...traveler, status: "Banned" } : traveler
      )
    );
    toast.success("User banned successfully");
  };

  const handleViewProfile = (id: number) => {
    navigate(`/admin/traveler-profile/${id}`);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Manage Travelers</h1>
        <p className="text-body-text">View and moderate the traveler user base</p>
      </div>

      <Card className="glass-panel border-0">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search travelers by name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Traveler Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTravelers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No travelers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTravelers.map((traveler) => (
                    <TableRow key={traveler.id}>
                      <TableCell 
                        className="font-medium text-primary hover:underline cursor-pointer"
                        onClick={() => handleViewProfile(traveler.id)}
                      >
                        {traveler.name}
                      </TableCell>
                      <TableCell>{traveler.email}</TableCell>
                      <TableCell>{traveler.joinDate}</TableCell>
                      <TableCell>
                        <span className={traveler.status === "Active" ? "text-green-600" : "text-red-600"}>
                          {traveler.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewProfile(traveler.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {traveler.status === "Active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleBanUser(traveler.id)}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Ban
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

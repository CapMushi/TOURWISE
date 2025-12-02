import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import ManageAgents from "./ManageAgents";
import ManageTravelers from "./ManageTravelers";

export default function ManageUsers() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-heading mb-2">Manage Users</h1>
        <p className="text-body-text">Oversee all platform users - agents and travelers</p>
      </div>

      <Card className="glass-panel border-0">
        <CardContent className="pt-6">
          <Tabs defaultValue="agents" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="agents">Travel Agents</TabsTrigger>
              <TabsTrigger value="travelers">Travelers</TabsTrigger>
            </TabsList>

            <TabsContent value="agents">
              <ManageAgents />
            </TabsContent>

            <TabsContent value="travelers">
              <ManageTravelers />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

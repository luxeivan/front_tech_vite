import { Card, Divider, Space, Typography } from "antd";
import BrandSunLoader from "../../components/ui/BrandSunLoader";
import styles from "./LoaderDemoPage.module.css";

export default function LoaderDemoPage() {
  return (
    <section className={styles.page}>
      <Typography.Title level={2} className={styles.title}>
        Демо фирменного лоадера
      </Typography.Title>

      <div className={styles.grid}>
        <Card title="Inline">
          <Space size="large" align="center" wrap>
            <BrandSunLoader size={24} />
            <BrandSunLoader size={36} />
            <BrandSunLoader size={52} />
            <BrandSunLoader size={68} />
          </Space>
        </Card>

        <Card title="С подписью">
          <Space direction="vertical" size="large">
            <BrandSunLoader size={28} text="Загрузка" />
            <BrandSunLoader size={42} text="Обновляем данные" />
          </Space>
        </Card>

        <Card title="Внутри блока">
          <div className={styles.panelPreview}>
            <BrandSunLoader size={56} text="Загружаем оперативную обстановку" />
          </div>
        </Card>

        <Card title="Как fullscreen Spin">
          <div className={styles.fullscreenPreview}>
            <BrandSunLoader size={64} text="Пожалуйста, подождите" />
          </div>
        </Card>
      </div>

      <Divider />

      <Typography.Text type="secondary">
        Временный маршрут: /loader-demo
      </Typography.Text>
    </section>
  );
}

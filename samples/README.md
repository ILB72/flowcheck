# 예시 CSV 출처

이 폴더의 CSV 3개는 FlowCheck를 위해 **합성**한 분류 결과 라벨 목록입니다(헤더 `predicted`, 한 줄에 클래스명 하나).

- `sample_paper_pc.csv`: 논문 표의 PC 트래픽 697 Flow 분류 건수(BelkinCamera 392, AmazonEcho 186, SamsungSmartThings 100, NetatmoWeatherStation 18, TPLinkSmartPlug 1)를 라벨 목록으로 풀어 쓴 것. 행 순서는 섞었습니다.
- `sample_balanced.csv`, `sample_mild.csv`: 균등(20건씩)과 약한 쏠림(35/25/20/12/8)을 보여 주려는 임의 예시.

UNSW-IoTraffic 원자료, 실제 트래픽, 식별자(IP·MAC 등)는 포함하지 않습니다.
